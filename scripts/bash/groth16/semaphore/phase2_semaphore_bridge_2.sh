#!/bin/bash

source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./build/semaphore_bridge2 semaphore_bridge_2 ./artifacts/circuits/semaphore
move_verifiers_and_metadata ./build/semaphore_bridge2 2 semaphore