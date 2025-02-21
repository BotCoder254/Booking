const fs = require('fs');
const path = require('path');

// Ensure profile images directory exists
const profileImagesDir = path.join(__dirname, '../public/images');
if (!fs.existsSync(profileImagesDir)) {
    fs.mkdirSync(profileImagesDir, { recursive: true });
}

// Copy default profile image if it doesn't exist
const defaultProfileImage = path.join(profileImagesDir, '@profiledefault.jpg');
if (!fs.existsSync(defaultProfileImage)) {
    try {
        // Update the source path to use @images directory
        const sourceImage = path.join(__dirname, '../@images/@profiledefault.jpg');
        
        // Check if source image exists
        if (fs.existsSync(sourceImage)) {
            fs.copyFileSync(sourceImage, defaultProfileImage);
            console.log('Default profile image copied successfully');
        } else {
            console.warn('Source profile image not found:', sourceImage);
            // Create a symbolic link instead of copying
            fs.symlinkSync(
                path.join(__dirname, '../@images/@profiledefault.jpg'),
                defaultProfileImage
            );
        }
    } catch (error) {
        console.warn('Error setting up default profile image:', error.message);
        // Fallback: Just use the direct path in @images
        // Update the User model default path
        const User = require('../models/User');
        User.schema.path('profileImage').default('/@images/@profiledefault.jpg');
    }
} 