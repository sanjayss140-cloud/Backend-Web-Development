/**
 * Node.js Runtime Features — Streams, Buffers & the File System
 *
 * GOAL
 * Move the SAME file two different ways and feel the difference:
 *   1) Load the whole file into memory with fs.readFile, and log its size.
 *   2) Flow the file through a stream and pipe it to a writable stream (a copy).
 * Then explain, in your own words, why the stream approach is preferable for
 * large files.
 *
 * The starter already imports `fs` and `path` for you and points at a large
 * sample file (`sample-data.txt`) that lives next to this script.
 *
 * Run it with:  npm start
 */

const fs = require('fs');
const path = require('path');

// Absolute, OS-safe path to the sample file (do NOT hand-build paths with '+').
const INPUT = path.join(__dirname, 'sample-data.txt');
const OUTPUT = path.join(__dirname, 'sample-copy.txt');

// ── PART 1: read the whole file into memory, then log its size ──────────────
function readWholeFile() {
  fs.readFile(INPUT, (err, data) => {
    if (err) {
      console.error('Error reading file:', err.message);
      return;
    }
    console.log(`readFile: loaded ${data.length} bytes into memory at once`);
  });
}

// ── PART 2: stream the file and pipe it to a writable stream ────────────────
function streamFile() {
  const readable = fs.createReadStream(INPUT);
  const writable = fs.createWriteStream(OUTPUT);

  readable.pipe(writable);

  writable.on('finish', () => {
    console.log('stream: finished copying via 64KB chunks (peak memory stays flat)');
  });

  readable.on('error', (err) => {
    console.error('Read stream error:', err.message);
  });

  writable.on('error', (err) => {
    console.error('Write stream error:', err.message);
  });
}

// ── PART 3: explain the difference ──────────────────────────────────────────
// YOUR EXPLANATION:
// fs.readFile loads the entire file contents into memory at once, meaning memory consumption scales directly with the file size and can easily crash the Node.js runtime on large payloads.
// In contrast, streams transfer data sequentially in small chunks (such as 64 KB), passing each chunk along and releasing it before reading the next.
// This allows streams to maintain flat, minimal peak memory consumption regardless of how large the file is.

// Run both approaches.
readWholeFile();
streamFile();

module.exports = { readWholeFile, streamFile, INPUT, OUTPUT };
