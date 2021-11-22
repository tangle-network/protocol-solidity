#!/bin/bash

# Copy the latest locally generated types into the package
cp ./typechain/*.d.ts ./src/typechain/

# Replace import paths of local typechain to the copied typechain for classes 
if [[ "$OSTYPE" == "darwin"* ]]; then
  find ./src/ -type f -name "*.js" -print0 | xargs -0 sed -i '' -e 's/../../typechain/../typechain/g'
else
  find ./src/ -type f -name "*.js" -print0 | xargs -0 sed -i -e 's/../../typechain/../typechain/g'
fi

# Overwrite the Poseidon typechain

