<?php
/**
 * This file references TestClass to create valid usages
 */

// Importing the TestClass files
require_once __DIR__ . '/test1.php';
require_once __DIR__ . '/test2.php';
require_once __DIR__ . '/test3.php';

// Using the TestClass instances
function useTestClasses() {
    $test1 = new TestClass();
    $test2 = new TestClass2();
    $test3 = new TestClass3();
    
    return [
        $test1->doSomething(),
        $test2->doSomethingElse(),
        $test3->doAnotherThing()
    ];
}