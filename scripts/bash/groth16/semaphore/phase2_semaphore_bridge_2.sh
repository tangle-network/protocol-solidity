#!/bin/bash

source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./build/semaphore semaphore_bridge_2 ./artifacts/circuits/semaphore
move_verifiers_and_metadata ./build/semaphore 2 semaphore