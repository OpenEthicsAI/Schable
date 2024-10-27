async function schable(jsonSchemaUrl, selector, captions = true, proxy = false, max_depth = 8) {
	try {
		const schema = await getSchemaByUrl(jsonSchemaUrl, proxy);
		if (schema === undefined) {
			throw new Error(`Schema JSON is not loaded.`);
		}

		if (!document.getElementById("modal")) {
			createModal();
		}

		const container = document.querySelector(selector);
		if (!container) {
			throw new Error(`There's no such selector in the document body: ${selector}.`);
		}
		container.classList.add("schable");

		const figure = document.createElement("figure");
		figure.className = "schable-figure";

		if (captions) {
			const caption = document.createElement("figcaption");
			caption.className = "schable-caption";

			if (schema["title"] !== undefined || schema["$id"] !== undefined || schema["$schema"] !== undefined || schema["type"] !== undefined) {
				const schemaIntroDiv = document.createElement("div");
				schemaIntroDiv.classList.add("schema-intro");
				let schemaInfo = "Schema";

				if (schema["title"] !== undefined) {
					schemaInfo += ` <strong class="schema-title">${schema["title"]}</strong>`;
				}

				if (schema["$id"] !== undefined) {
					schemaInfo += ` <strong class="schema-id">(${schema["$id"]})</strong>`;
				}

				if (schema["type"] !== undefined) {
					schemaInfo += ` defines <strong class="schema-type">${schema["type"]}</strong>`;
				}

				if (schema["$schema"] !== undefined) {
					schemaInfo += ` using standard schema specification <strong class="schema-specification">${schema["$schema"]}</strong>`;
				}

				schemaIntroDiv.innerHTML = schemaInfo;
				caption.appendChild(schemaIntroDiv);
			}

			figure.appendChild(caption);
		}

		// Wait for createSchemaTable to finish, then applyBackgroundColor
		createSchemaTable(schema, max_depth)
			.then((table) => {
				if (!table) {
					throw new Error(`Error creating table from schema.`);
				}
				table.className = "schable-table";
				figure.appendChild(table);
				container.appendChild(figure);

				applyBackgroundColor();
			})
			.catch((error) => {
				console.error("Error creating table:", error);
			});
	} catch (error) {
		// Handle the error
		console.error("Error:", error);
	}
}

async function createSchemaTable(schema, max_depth = 8) {
	const table = document.createElement("div");

	const requiredSchemaKeys = ["properties", "items", "type"];
	if (!Object.keys(schema).some((key) => requiredSchemaKeys.includes(key))) {
		throw new Error(`None of the Required schema keys (${requiredSchemaKeys}) are present.`);
	}

	const headerRow = document.createElement("div");
	headerRow.className = "header";
	const headerCells = [
		{ class: "name", value: "Name" },
		{ class: "type", value: "Type" },
		{ class: "description", value: "Description" },
		{ class: "required", value: "Required" },
	];
	headerCells.forEach((cell, index) => {
		const th = document.createElement("div");
		const span = document.createElement("span");
		span.innerHTML = `${cell.value}`;
		th.appendChild(span);
		th.className = `${cell.class}`;
		headerRow.appendChild(th);
	});
	table.appendChild(headerRow);

	//let path = "{Root}"
	async function addRow(schema, property, propertyData, ...additionalArgs) {
		//TODO add support for Schema prefixItems

		const indentLevel = additionalArgs[0] !== undefined ? additionalArgs[0] : 0;
		//additionalArgs[1] used for refPath
		const required = additionalArgs[2] !== undefined ? additionalArgs[2] : false;
		const constraintCategory = additionalArgs[3] !== undefined ? additionalArgs[3] : false;
		const constraintCount = additionalArgs[4] !== undefined ? additionalArgs[4] : 0;
		const path = additionalArgs[5] !== undefined ? additionalArgs[5] : "";

		const constraintCategories = ["allOf", "oneOf", "anyOf", "not"];
		const basicTypes = ["string", "number", "integer", "boolean", "null"];

		//console.log("> BEGIN addRow");
		console.log([schema, path, property, propertyData, required]);

		if (propertyData.$ref) {
			const refPath = propertyData.$ref;

			const refSubschemaContext = await getSubschemaByRef(schema, refPath);
			const refSubschema = refSubschemaContext[1];
			//console.log("context", refSubschemaContext)

			const mergedProperties = {
				...refSubschema, // Copy all properties from refSubschema and override with description, required
				description: concatenateSchemaDescriptions(propertyData.description, refSubschema.description), // Use description from propertyData if available, otherwise use from referred schema
				required: propertyData.required || refSubschema.required, // Use required from propertyData if available, otherwise use from referred schema
			};
			//refSubschemaContext[0] transmits the schema context for adding a new row. This is useful for multiple nesting
			const propertyPath = path;
			console.log(path, propertyPath);

			await addRow(refSubschemaContext[0], property, mergedProperties, indentLevel, refPath, required, undefined, undefined, propertyPath);
		} else if (Object.keys(propertyData).some((key) => constraintCategories.includes(key))) {
			for (const constraintCategory of constraintCategories) {
				if (Object.keys(propertyData).includes(constraintCategory)) {
					//console.log(`property: ${property} - ${constraintCategory}`);
					const constraints = propertyData[constraintCategory];
					const propertyPath = path;
					console.log(path, propertyPath);

					for (let i = 0; i < constraints.length; i++) {
						// Process properties within allOf, oneOf, anyOf, not
						const mergedProperties = {
							...constraints[i], // Copy all properties from constraints[i] and supply  with description, required
							description: concatenateSchemaDescriptions(propertyData.description, constraints[i].description),
						};
						await addRow(schema, property, mergedProperties, indentLevel, undefined, required, constraintCategory, constraints.length, propertyPath);
					}
				}
			}
		} else {
			const row = document.createElement("div");
			//console.log("-----------------------------");
			//console.log(additionalArgs[1]);
			row.className = "element";

			let propertyValue = property;
			let typeValue = propertyData.type;
			let descriptionValue = propertyData.description || `No description available`;
			let requiredValue = `<i class="far fa-lightbulb"></i> optional`;
			let propertyTitle = ``;
			let typeTitle = ``;
			let descriptionTitle = ``;
			let requiredTitle = `This is an optional property`;
			let constValue = propertyData.const;

			if (constraintCategory) {
				//add a constraintCategory
				propertyValue = `${propertyValue} <i class="far fa-dot-circle constraintCategory"></i>`;
				propertyTitle = `The property ${property} could be ${constraintCategory} the ${constraintCount} types outlined, including ${propertyData.type}.`;
				if (constValue !== undefined && basicTypes.includes(typeValue)) {
					descriptionValue = `${descriptionValue}. Accepted ${typeValue} value for ${constraintCategory} schema constraint is: <em class="constValue">${constValue}</em>.`;
					typeValue = `${typeValue}:<em class="constValue">${constValue}</em><sup class="constraintCategory">(${constraintCategory})</sup>`;
				} else {
					typeValue = `${typeValue}<sup class="constraintCategory">(${constraintCategory})</sup>`;
				}
			}
			if (propertyData.enum !== undefined) {
				descriptionValue = `${descriptionValue}. Accepted values for the enumerated type are: <em class="constValue">${enumListToString(
					propertyData.enum
				)}</em>.`;
				typeValue = `Enumerated ${enumListUniqueDataTypes(propertyData.enum)}`;
			}
			if (additionalArgs[1] !== undefined) {
				//add a refPath
				propertyValue = `${propertyValue} <i class="fas fa-paperclip refPath" title="${additionalArgs[1]}"></i>`;
				propertyTitle = `${propertyTitle} The property is defined using the schema located at ${additionalArgs[1]}`;
			}
			if (required) {
				requiredValue = `<i class="far fa-check-square"></i> required`;
				requiredTitle = `This is a required property`;
			}

			const cells = [
				{ class: "name", value: propertyValue, title: propertyTitle },
				{ class: "type", value: typeValue, title: typeTitle },
				{ class: "description", value: descriptionValue, title: descriptionTitle },
				{ class: "required", value: requiredValue, title: requiredTitle },
			];

			const elementJson = {
				name: { value: propertyValue, title: propertyTitle },
				type: { value: typeValue, title: typeTitle },
				description: { value: descriptionValue, title: descriptionTitle },
				required: { value: requiredValue, title: requiredTitle },
				path: path,
				indent: indentLevel,
			};
			cells.forEach((cell, index) => {
				const td = document.createElement("div");
				const div = document.createElement("div");
				div.innerHTML = `${cell.value}`;
				td.className = `${cell.class}`;
				td.title = `${cell.title}`;

				if (cell.value == undefined) {
					td.classList.add("undefined");
				}
				// first column of the table
				if (index === 0) {
					const border = document.createElement("div");
					const indentation = document.createElement("div");

					indentation.className = "indentation";
					indentation.style.width = `${indentLevel * 8}px`;
					border.className = "border";
					//border.style.backgroundColor = palette[indentLevel];

					td.appendChild(indentation);
					td.appendChild(border);
					div.className = "property";

					td.appendChild(div);
				} else {
					td.appendChild(div);
				}
				row.appendChild(td);
			});
			row.setAttribute("data-json", JSON.stringify(elementJson));
			row.setAttribute("data-path", path);
			row.setAttribute("data-indent", indentLevel);
			table.appendChild(row);

			if (propertyData.type === "object" && propertyData.properties && indentLevel < max_depth) {
				// Recursively add rows for nested objects
				for (const [nestedProperty, nestedPropertyData] of Object.entries(propertyData.properties)) {
					const required = propertyData.required && propertyData.required.includes(nestedProperty);
					const propertyPath = path + "." + nestedProperty;
					console.log(path, propertyPath);

					await addRow(schema, nestedProperty, nestedPropertyData, indentLevel + 1, undefined, required, undefined, undefined, propertyPath);
				}
			} else if (propertyData.type === "array" && propertyData.items && indentLevel < max_depth) {
				// Handle array type with nested properties
				//console.log(property, "array", propertyData.items);
				const propertyPath = path + "[0]";
				console.log(path, propertyPath);

				await addRow(schema, `${property} item`, propertyData.items, indentLevel + 1, undefined, required, undefined, undefined, propertyPath);
			}
		}
	}

	try {
		await addRow(
			schema,
			`schema <i class="far fa-folder-open" title="This is a root element"></i>`,
			schema,
			-1,
			undefined,
			true,
			undefined,
			undefined,
			"{Root}"
		);

		return table;
	} catch (error) {
		console.error("Error creating schema table:", error);
		throw error;
	}
}

function enumListToString(list) {
	return list
		.map((item) => {
			if (item === null) {
				return "null";
			} else if (typeof item === "string") {
				return `"${item}"`;
			} else {
				return String(item);
			}
		})
		.join(", ");
}

function enumListUniqueDataTypes(list) {
	const uniqueTypes = new Set();

	list.forEach((item) => {
		let type;
		if (typeof item === "object" && item === null) {
			type = "null";
		} else {
			type = typeof item;
		}
		uniqueTypes.add(type);
	});

	return Array.from(uniqueTypes).join(", or ");
}

async function getSchemaByUrl(jsonSchemaUrl, proxy = true) {
	try {
		let proxifiedUrl = jsonSchemaUrl;
		if (proxy === true) {
			const proxyUrl = "https://corsproxy.io/?";
			proxifiedUrl = proxyUrl + encodeURIComponent(jsonSchemaUrl);
		}
	  const response = await fetch(proxifiedUrl);
	  const schema = await response.json();
	  return schema;
	} catch (error) {
	  console.error(`Error fetching JSON schema: ${proxifiedUrl} with proxy ${proxy}`, error);
	}
}

async function getSubschemaByRef(schema, refPath) {
	let refSubschema;

	try {
		refUrlObject = new URL(refPath);
		//console.log(`${refPath} String is an URL`);
		//console.log(refUrlObject);
		const subschema = await getSchemaByUrl(refPath, proxy);

		//console.log(subschema);

		if (refUrlObject.hash !== "") {
			//console.log("The element refers to the subschema with URL that contains a fragment identifier:", refUrlObject.hash);
			refSubschema = await getSubschemaByHashFragment(subschema, refUrlObject.hash);
			return [subschema, refSubschema];
		} else {
			//console.log("The subschema is directly referred using URL at root and does not contain a nested fragment identifier.");
			return [subschema, subschema];
		}
	} catch (error) {
		//console.log(`${refPath} is a fragment within the same schema, string is NOT a URL`);
		refSubschema = await getSubschemaByHashFragment(schema, refPath);
		return [schema, refSubschema];
	}
}

async function getSubschemaByHashFragment(schema, fragment) {
	const lastSlashIndex = fragment.lastIndexOf("/");
	if (lastSlashIndex > 0) {
		//console.log("is Pointer");
		try {
			const subschema = await getJsonValueByPointer(schema, fragment);
			return subschema;
		} catch (error) {
			console.error(error);
			return undefined;
		}
	} else if (fragment.startsWith("#") && lastSlashIndex == -1) {
		//console.log("is Anchor");
		const anchor = fragment.substring(1);
		const subschema = await getSubschemaByAnchor(schema, anchor);
		return subschema;
	} else {
		//console.log(`Strange exception.`);
		return undefined;
	}
}

async function getSubschemaByAnchor(schema, targetAnchor) {
	for (const key in schema) {
		if (typeof schema[key] === "object" && schema[key] !== null) {
			const result = await getSubschemaByAnchor(schema[key], targetAnchor);
			if (result) {
				return result;
			}
		}
	}
	if (schema.$anchor === targetAnchor) {
		return schema;
	} else {
		return undefined;
	}
}

async function getJsonValueByPointer(jsonObject, pointer) {
	if (!jsonObject || typeof jsonObject !== "object") {
		console.log("Invalid JSON object");
	}

	if (!pointer || typeof pointer !== "string") {
		console.log("Invalid JSON Pointer");
	}

	const pointerParts = pointer.split("/").slice(1); // Removing the empty string at the beginning

	let currentObject = jsonObject;

	for (const part of pointerParts) {
		if (currentObject.hasOwnProperty(part)) {
			currentObject = currentObject[part];
		} else {
			//console.log(`Pointer '${pointer}' not found in the JSON object`);
		}
	}

	return currentObject;
}

function concatenateSchemaDescriptions(schemaDescription, subschemaDescription) {
	if (schemaDescription && subschemaDescription) {
		return schemaDescription + ". " + subschemaDescription; //extending the description with the next sentence after .
	} else if (schemaDescription) {
		return schemaDescription;
	} else if (subschemaDescription) {
		return subschemaDescription;
	} else {
		return undefined;
	}
}

//function to invoke modal
(function () {
	// Function to handle click event
	function showPropertyDetails(parentWithDataPath) {
		var dataJson = parentWithDataPath.dataset.json;
		var elementJson = JSON.parse(dataJson);

		if (elementJson) {
			var modal = document.getElementById("modal");
			var pathField = document.getElementById("pathField");
			var property = document.getElementById("modalProperty");
			var colored = document.getElementById("modalColored");
			var description = document.getElementById("modalDescription");
			var required = document.getElementById("modalRequired");
			var type = document.getElementById("modalType");

			const propertyColor = parentWithDataPath.querySelector(".border").style.backgroundColor;

			pathField.innerHTML = elementJson.path;

				// Add copy icon to all elements with class 'copyText'
			var copyTextElements = document.querySelectorAll(".copyText");
			copyTextElements.forEach(function (copyTextElement) {
				var copyIcon = document.createElement("i");
				copyIcon.classList.add("far", "fa-clipboard", "copy-icon");
		 		copyIcon.onclick = function () {
					copyToClipboard(copyTextElement.textContent, feedbackColor=propertyColor);
				};
				copyTextElement.appendChild(copyIcon);
			});

			
			property.innerHTML = '<span id="modalMarker">👉 </span>' + elementJson.name.value;
			description.innerHTML = elementJson.description.value;
			type.innerHTML = "Type: " + elementJson.type.value;
			required.innerHTML = elementJson.required.value;
			colored.style.backgroundColor = propertyColor;

			modal.style.display = "block";
		}
	}

	// When the user clicks anywhere outside of the modal, close it
	window.addEventListener("click", function (event) {
		var modal = document.getElementById("modal");
		if (modal && event.target == modal) {
			modal.style.display = "none";
		}
	});

	// Delegate the click event to the document
	document.addEventListener("click", function (event) {
		// Check if the clicked element or any of its ancestors have the class "element" within the ".schable-table"
		if (event.target.closest(".schable-table") && event.target.matches(".property")) {
			// Get the nearest ancestor with the data-json attribute
			var parentWithDataPath = event.target.closest("[data-json]");
			// Check if such ancestor exists
			if (parentWithDataPath) {
				// Get the value of the data-json attribute
				showPropertyDetails(parentWithDataPath);
			}
		}
	});
})();

function createModal() {
	// Create modal element
	var modal = document.createElement("div");
	modal.id = "modal";
	modal.className = "modal";
	modal.innerHTML = `
	<div class="modal-content">
		<h1 id="modalProperty"></h1>
		<hr id="modalColored" />
		<em id="modalRequired"></em>
		<p id="modalDescription"></p>
		<p id="modalType"></p>
		<label for="pathField">Property path in JSON object:</label>
		<p id="pathField" class="copyText"></p>
		<button id="closeButton">Close</button>
	</div>
		`;

	document.body.appendChild(modal);

	// Add event listener for the close button
	var closeButton = document.getElementById("closeButton");
	closeButton.addEventListener("click", function () {
		var modal = document.getElementById("modal");
		modal.style.display = "none";
	});


}

// Copy text to clipboard function
function copyToClipboard(content, feedbackColor="#3e8914") {
	var tempInput = document.createElement("textarea");
	tempInput.value = content;
	document.body.appendChild(tempInput);
	tempInput.select();
	document.execCommand("copy");
	document.body.removeChild(tempInput);

	// Change icon color briefly to indicate successful copy
	var copyIcon = event.target;
	copyIcon.classList.remove('fa-clipboard', 'far');
    copyIcon.classList.add('fa-clipboard-check', 'fas');
	copyIcon.style.color = feedbackColor;
	setTimeout(function () {
		copyIcon.classList.remove('fa-clipboard-check', 'fas');
        copyIcon.classList.add('fa-clipboard', 'far');
		copyIcon.style.color = "";
	}, 1000);
}

// Function to calculate the background color based on parent color and indent level
function calculateColor(parentColor, indent) {
	const alpha = Math.min(0xff - indent * 0x28, 0xff);
	const alphaHex = alpha.toString(16).padStart(2, "0");
	return parentColor.slice(0, 7) + alphaHex;
}

function rgbStringToHex(rgbString) {
	try {
		// Extract RGB components from the input string
		var rgb = rgbString.match(/\d+/g);
		var r = parseInt(rgb[0]);
		var g = parseInt(rgb[1]);
		var b = parseInt(rgb[2]);

		// Convert each RGB component to hexadecimal
		var hexR = r.toString(16).padStart(2, "0");
		var hexG = g.toString(16).padStart(2, "0");
		var hexB = b.toString(16).padStart(2, "0");

		// Construct the hexadecimal color string
		var hexColor = "#" + hexR + hexG + hexB;

		return hexColor.toUpperCase(); // Optionally convert to uppercase
	} catch (error) {
		return "#ffffffff";
	}
}

function getParentPropertyPath(path) {
	if (path.endsWith("]")) {
		return path.substring(0, path.lastIndexOf("["));
	} else if (/^[a-zA-Z0-9]$/.test(path.charAt(path.length - 1))) {
		return path.substring(0, path.lastIndexOf("."));
	}
	return path;
}

const palette = ["#0e84a8", "#bc5090", "#ff6361", "#ffa600", "#003f5c", "#58508d"];

// Function to apply background color to .border elements
function applyBackgroundColor() {
	const elements = document.querySelectorAll(".element");
	let zeroIndentIndex = 0; // Track the index for elements with indent === 0

	elements.forEach((element) => {
		const indent = parseInt(element.getAttribute("data-indent"));
		const path = element.getAttribute("data-path");
		const parentPath = getParentPropertyPath(path);
		const parentElement = document.querySelector(`.element[data-path="${parentPath}"]`);

		//console.log("parent path - path", parentPath, path);

		let color;
		if (indent === 0) {
			// Select color from palette based on zeroIndentIndex
			color = palette[zeroIndentIndex % palette.length];
			zeroIndentIndex++;
		} else {
			// Calculate color
			const parentColor = parentElement.querySelector(".border").style.backgroundColor;
			//console.log(parentElement, parentColor);
			color = calculateColor(rgbStringToHex(parentColor), indent);
		}

		//console.log(color);

		const border = element.querySelector(".border");
		border.style.backgroundColor = color;
	});
}
