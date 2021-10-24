pragma circom 2.0.0;

include "../semaphore/semaphore-base.circom";

component main {public [nullifier_hash, signal_hash, external_nullifier, roots]} = Semaphore(20, 2);

