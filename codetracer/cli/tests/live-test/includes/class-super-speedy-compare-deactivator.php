<?php
/**
 * Fired during plugin deactivation
 *
 */
class Super_Speedy_Compare_Deactivator {

    /**
     * Deactivate the plugin
     * 
     * This class only exists for consistency with WordPress plugin standards.
     * We don't need to do anything on deactivation for now.
     * Note: We do NOT drop tables on deactivation to avoid data loss.
     */
    public static function deactivate() {
        // Currently no action required on deactivation
    }
}