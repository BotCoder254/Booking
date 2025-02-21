// Error handling middleware
module.exports = (err, req, res, next) => {
    console.error(err.stack);
    
    // Set locals for error template
    const errorDetails = process.env.NODE_ENV === 'development' ? err : {};
    
    res.status(500).render('error', {
        title: 'Server Error',
        message: 'Something went wrong!',
        error: errorDetails,
        stack: process.env.NODE_ENV === 'development' ? err.stack : ''
    });
}; 