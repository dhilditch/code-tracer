# Super Speedy Compare

A WordPress plugin to create side-by-side comparisons between your Super Speedy plugins and their competitors.

## Description

Super Speedy Compare allows you to easily create feature comparison tables between your various Super Speedy plugins and their competitors. The plugin provides an intuitive admin interface where you can:

- Add your Super Speedy plugins with details (name, acronym, description, image, etc.)
- Add competitors for each of your plugins
- Define features for each plugin group
- Set feature values for your plugins and competitors

## Database Structure

The plugin uses four custom database tables:

1. **wp_ssc_my_plugins** - Stores information about your Super Speedy plugins
2. **wp_ssc_competitors** - Stores information about competitor plugins
3. **wp_ssc_features** - Stores feature definitions for each plugin group
4. **wp_ssc_plugin_features** - Stores feature values for plugins and competitors

## Installation

1. Upload the `super-speedy-compare` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Access the plugin through the 'SS Compare' menu in the WordPress admin

## Usage

### Adding Your Plugins

1. Go to "SS Compare" > "My Plugins" in the WordPress admin menu
2. Fill out the form with your plugin details:
   - Plugin Name (e.g., "Super Speedy Search")
   - Plugin Slug (e.g., "super-speedy-search")
   - Plugin Acronym (e.g., "SSS")
   - Description
   - Image
   - Sales Page URL
   - Price

### Adding Competitors

1. From the My Plugins page, click the "Competitors" button for the plugin you want to add competitors to
2. Fill out the form with the competitor details:
   - Competitor Name
   - Competitor Slug
   - Description
   - Image
   - Website URL
   - Affiliate URL (optional)
   - Price

### Managing Features

1. From the My Plugins page, click the "Features" button for the plugin you want to manage features for
2. In the "Add/Edit Feature" tab, add features that you want to compare:
   - Feature Name (e.g., "Search Speed")
   - Description
   - Order (to determine the display order in the comparison table)

### Setting Feature Values

1. In the same Features page, navigate to the "Set Feature Values" tab
2. For your plugin and each competitor, set the feature values:
   - Choose the value type (Yes/No, Number, or Text)
   - Set the value for each feature

The plugin highlights missing feature values to make it easy to identify which ones still need to be configured.

## Feature Types

The plugin supports three types of feature values:

1. **Boolean (Yes/No)** - For features that are either present or not
2. **Number** - For quantitative features (e.g., search speed in milliseconds)
3. **Text** - For descriptive features or features with custom values

## Development

### Files Structure

- `super-speedy-compare.php` - Main plugin file
- `includes/` - Core plugin classes
  - `class-super-speedy-compare.php` - Main plugin class
  - `class-super-speedy-compare-activator.php` - Activation class
  - `class-super-speedy-compare-deactivator.php` - Deactivation class
  - `class-super-speedy-compare-db.php` - Database handling class
- `admin/` - Admin-related files
  - `class-super-speedy-compare-admin.php` - Admin class
  - `css/super-speedy-compare-admin.css` - Admin styles
  - `js/super-speedy-compare-admin.js` - Admin scripts
  - `partials/` - Admin page templates
    - `my-plugins-page.php` - My Plugins page template
    - `select-plugin-page.php` - Plugin selection page template
    - `competitors-page.php` - Competitors page template
    - `features-page.php` - Features page template

## Future Enhancements

- Frontend shortcode to display comparison tables on the website
- Export/import functionality for plugin data
- More visual customization options for comparison tables
- Ability to add custom feature types