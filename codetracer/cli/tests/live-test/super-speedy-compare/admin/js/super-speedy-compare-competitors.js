/**
 * Super Speedy Compare - Competitors JS
 */
(function($) {
    'use strict';

    console.log('SSC Competitors script loaded');

    // Initialize on document ready
    $(document).ready(function() {
        console.log('SSC Competitors init');
        initCompetitorsPage();
    });

    // Initialize Competitors Page
    function initCompetitorsPage() {
        // Direct click handler on submit button to prevent normal form submission
        $(document).on('click', '#add-competitor-btn', function(e) {
            e.preventDefault();
            console.log('Competitor submit button clicked');
            
            const form = $(this).closest('form');
            submitCompetitorForm(form);
            
            return false; // Ensure no form submission
        });

        // Also handle the form submission as backup - using event delegation
        $(document).on('submit', '#ssc-competitor-form', function(e) {
            e.preventDefault();
            console.log('Competitor form submitted');
            
            submitCompetitorForm($(this));
            
            return false; // Ensure no form submission
        });

        // Edit competitor buttons
        $(document).on('click', '.ssc-edit-competitor', function(e) {
            e.preventDefault();
            
            const button = $(this);
            const competitorId = button.data('id');
            const form = $('#ssc-competitor-form');
            
            // Get competitor data from button's data attributes
            const competitor = {
                id: competitorId,
                name: button.data('name'),
                slug: button.data('slug'),
                description: button.data('description'),
                image_url: button.data('image-url'),
                website_url: button.data('website-url'),
                affiliate_url: button.data('affiliate-url'),
                price: button.data('price')
            };
            
            // Update form
            form.find('[name="id"]').val(competitor.id);
            form.find('[name="name"]').val(competitor.name);
            form.find('[name="slug"]').val(competitor.slug);
            form.find('[name="description"]').val(competitor.description);
            form.find('[name="price"]').val(competitor.price);
            form.find('[name="website_url"]').val(competitor.website_url);
            form.find('[name="affiliate_url"]').val(competitor.affiliate_url);
            
            // Update image preview
            if (competitor.image_url) {
                form.find('[name="image_url"]').val(competitor.image_url);
                form.find('.ssc-media-preview').html('<img src="' + competitor.image_url + '" alt="">');
            } else {
                form.find('[name="image_url"]').val('');
                form.find('.ssc-media-preview').empty();
            }
            
            // Update form title and button text
            form.find('h2').text(form.data('edit-title'));
            form.find('.ssc-submit-btn').text(form.data('edit-button'));
            
            // Scroll to form
            $('html, body').animate({
                scrollTop: form.offset().top - 100
            }, 500);
        });
        
        // Delete competitor buttons
        $(document).on('click', '.ssc-delete-competitor', function(e) {
            e.preventDefault();
            
            if (!confirm(sscAdminVars.strings.deleteConfirm)) {
                return;
            }
            
            const button = $(this);
            const competitorId = button.data('id');
            
            // Show loading state
            button.prop('disabled', true);
            
            // Send AJAX request
            $.ajax({
                url: sscAdminVars.ajaxurl,
                type: 'POST',
                data: {
                    action: 'ssc_delete_competitor',
                    id: competitorId,
                    nonce: sscAdminVars.nonce
                },
                success: function(response) {
                    if (response.success) {
                        if (typeof SSC_Common !== 'undefined') {
                            SSC_Common.showMessage(response.data.message);
                        } else {
                            alert(response.data.message);
                        }
                        
                        // Remove competitor from list
                        button.closest('tr, .ssc-plugin-card').remove();
                    } else {
                        if (typeof SSC_Common !== 'undefined') {
                            SSC_Common.showMessage(response.data.message, 'error');
                        } else {
                            alert(response.data.message);
                        }
                    }
                },
                error: function(xhr, textStatus, errorThrown) {
                    console.error('AJAX Error:', xhr.responseText, textStatus, errorThrown);
                    if (typeof SSC_Common !== 'undefined') {
                        SSC_Common.showMessage(sscAdminVars.strings.deleteError + ' - Check console for details.', 'error');
                    } else {
                        alert(sscAdminVars.strings.deleteError + ' - Check console for details.');
                    }
                },
                complete: function() {
                    button.prop('disabled', false);
                }
            });
        });
        
        // New competitor button
        $(document).on('click', '.ssc-new-competitor-btn', function(e) {
            e.preventDefault();
            
            const form = $('#ssc-competitor-form');
            
            // Reset form
            form[0].reset();
            form.find('input[type="hidden"]').not('[name="nonce"]').val('');
            form.find('.ssc-media-preview').empty();
            form.find('h2').text(form.data('new-title'));
            form.find('.ssc-submit-btn').text(form.data('new-button'));
            
            // Scroll to form
            $('html, body').animate({
                scrollTop: form.offset().top - 100
            }, 500);
        });
    }

    // Submit competitor form via AJAX
    function submitCompetitorForm(form) {
        console.log('Processing form submission', form);
        
        // Validate required fields
        if (!form.find('[name="name"]').val() || !form.find('[name="slug"]').val()) {
            console.error('Required fields missing');
            
            if (typeof SSC_Common !== 'undefined') {
                SSC_Common.showMessage(sscAdminVars.strings.requiredField, 'error');
            } else {
                alert(sscAdminVars.strings.requiredField);
            }
            return;
        }
        
        // Prepare form data with FormData for file uploads
        const formData = new FormData(form[0]);
        formData.append('action', 'ssc_save_competitor');
        
        // Log form data for debugging
        console.log('Form data being sent:');
        for (let pair of formData.entries()) {
            console.log(pair[0] + ': ' + pair[1]);
        }
        
        // Show loading state
        form.find('.ssc-submit-btn').prop('disabled', true);
        
        // Log AJAX URL
        console.log('AJAX URL:', sscAdminVars.ajaxurl);
        
        // Send AJAX request
        $.ajax({
            url: sscAdminVars.ajaxurl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                console.log('AJAX Success Response:', response);
                
                if (response.success) {
                    if (typeof SSC_Common !== 'undefined') {
                        SSC_Common.showMessage(response.data.message);
                    } else {
                        alert(response.data.message);
                    }
                    
                    // Reset form
                    form[0].reset();
                    form.find('input[type="hidden"]').not('[name="nonce"]').val('');
                    form.find('.ssc-media-preview').empty();
                    form.find('h2').text(form.data('new-title'));
                    form.find('.ssc-submit-btn').text(form.data('new-button'));
                    
                    // Reload page to show the new competitor
                    location.reload();
                } else {
                    console.error('AJAX Error Response:', response);
                    
                    if (typeof SSC_Common !== 'undefined') {
                        SSC_Common.showMessage(response.data.message, 'error');
                    } else {
                        alert(response.data.message);
                    }
                }
            },
            error: function(xhr, textStatus, errorThrown) {
                console.error('AJAX Error:', xhr.responseText, textStatus, errorThrown);
                
                if (typeof SSC_Common !== 'undefined') {
                    SSC_Common.showMessage(sscAdminVars.strings.saveError + ' - Check console for details.', 'error');
                } else {
                    alert(sscAdminVars.strings.saveError + ' - Check console for details.');
                }
            },
            complete: function() {
                console.log('AJAX request completed');
                form.find('.ssc-submit-btn').prop('disabled', false);
            }
        });
    }

})(jQuery);