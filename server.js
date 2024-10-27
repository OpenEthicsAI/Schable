const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const server = http.createServer((req, res) => {
  // Parse the request URL
  const parsedUrl = url.parse(req.url, true);

  // Set the content type to HTML by default
  let contentType = 'text/html';

  // Map file extensions to content types
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json', // Added JSON content type
  };

  // Get the file extension from the URL
  const ext = path.extname(parsedUrl.pathname);

  // Check if the extension is in the map, set content type accordingly
  if (mimeTypes[ext]) {
    contentType = mimeTypes[ext];
  }

  // Construct the file path
  let filePath = path.join(__dirname, parsedUrl.pathname);

  // If the filePath is a directory, append 'index.html'
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Check if the file exists before creating a read stream
  if (fs.existsSync(filePath)) {
    // Read the static file
    const readStream = fs.createReadStream(filePath);

    // Set the content type header
    res.setHeader('Content-Type', contentType);

    // Pipe the file to the response
    readStream.pipe(res);
  } else {
    // Respond with a 404 Not Found if the file doesn't exist
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
