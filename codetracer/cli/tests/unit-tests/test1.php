<?php
/**
 * Test file 1 with multiple comment blocks to check if merging works
 *
 * @usedby test-reference.php:3, 6, 11, 13 (reference)
 */
/**
 * Second comment block
 */
/**
 * Third comment block 
 */
class TestClass {
    public function doSomething() {
        return 'TestClass is working';
    }
}