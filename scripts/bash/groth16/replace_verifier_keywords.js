const fs = require('fs');

let args = process.argv;
let inputFilePath = args[2];
let outputDir = args[3];
let anchorSize = args[4];

fs.readFile(inputFilePath, 'utf8', function (err, data) {
  if (err) {
    return console.log(err);
  }
  var anchorSizeUpdated = anchorSize.indexOf('-') > -1 ? anchorSize.replace('-', '_') : anchorSize;
  var result = data.replace(/pragma solidity \^0.6.11;/g, 'pragma solidity ^0.8.0;');
  result = result.replace(/contract Verifier/g, `contract Verifier${anchorSizeUpdated}`);

  fs.writeFile(`${outputDir}/Verifier${anchorSizeUpdated}.sol`, result, 'utf8', function (err) {
     if (err) return console.log(err);
  });
});