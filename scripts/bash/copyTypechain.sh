#!/bin/bash

# Copy the latest locally generated types into the contracts package
cp -a ./typechain/. packages/contracts/src/
