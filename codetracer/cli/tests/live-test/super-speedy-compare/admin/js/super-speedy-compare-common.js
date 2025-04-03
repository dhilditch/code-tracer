(function($) {
    'use strict';

    // Common Admin JS Module
    window.SSC_Common = {
        // Initialize
        init: function() {
            this.initMediaUploader();
            this.initTabs();
        },

        // Initialize tabs
        initTabs: function() {
            $(document).on('click', '.ssc-tabs-nav a', function(e) {
                e.preventDefault();
                const target = $(this).attr('href');
                
                // Update active tab
                $('.ssc-tabs-nav a').removeClass('nav-tab-active');
                $(this).addClass('nav-tab-active');
                
                // Show target content
                $('.ssc-tab-content').hide();
                $(target).show();
            });
            
            // Activate first tab
            $('.ssc-tabs-nav a:first').trigger('click');
        },

        // Initialize Media Uploader
        initMediaUploader: function() {
            // Handle image upload button click
            $(document).on('click', '.ssc-upload-image', function(e) {
                e.preventDefault();
                
                const button = $(this);
                const imagePreview = button.siblings('.ssc-media-preview');
                const imageInput = button.siblings('.ssc-image-url');
                
                // Create WP media uploader
                const mediaUploader = wp.media({
                    title: sscAdminVars.strings.uploadImage,
                    button: {
                        text: sscAdminVars.strings.useThisImage
                    },
                    multiple: false
                });
                
                // When image is selected
                mediaUploader.on('select', function() {
                    const attachment = mediaUploader.state().get('selection').first().toJSON();
                    
                    // Update input value
                    imageInput.val(attachment.url);
                    
                    // Update preview
                    imagePreview.html('<img src="' + attachment.url + '" alt="">');
                });
                
                // Open media uploader
                mediaUploader.open();
            });
            
            // Handle image removal
            $(document).on('click', '.ssc-remove-image', function(e) {
                e.preventDefault();
                
                const button = $(this);
                const imagePreview = button.siblings('.ssc-media-preview');
                const imageInput = button.siblings('.ssc-image-url');
                
                // Clear input and preview
                imageInput.val('');
                imagePreview.empty();
            });
        },

        // Show a message
        showMessage: function(message, type = 'success') {
            const messageEl = $('<div class="ssc-message ' + type + '">' + message + '</div>');
            
            // Remove existing messages
            $('.ssc-message').remove();
            
            // Add new message
            $('.ssc-admin-header').after(messageEl);
            
            // Auto-remove after 5 seconds
            setTimeout(function() {
                messageEl.fadeOut(function() {
                    $(this).remove();
                });
            }, 5000);
        },

        // Reset form
        resetForm: function(form) {
            form[0].reset();
            form.find('input[type="hidden"]').not('[name="nonce"]').val('');
            form.find('.ssc-media-preview').empty();
            form.find('h2').text(form.data('new-title'));
            form.find('.ssc-submit-btn').text(form.data('new-button'));
        },

        // Scroll to form
        scrollToForm: function(form) {
            $('html, body').animate({
                scrollTop: form.offset().top - 100
            }, 500);
        }
    };

})(jQuery);