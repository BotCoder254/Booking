const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const path = require('path');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();

// MongoDB Connection URI
const uri = process.env.MONGODB_URI || "mongodb+srv://telvin:soulmind@cluster0.k9y9n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// MongoDB Connection Function
async function run() {
    try {
        // Connect the client to the server
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        // Connect Mongoose after successful client connection
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 60000, // Increase to 60 seconds
            socketTimeoutMS: 60000,
            connectTimeoutMS: 60000,
            // Don't close the connection
            autoClose: false,
            keepAlive: true,
            keepAliveInitialDelay: 300000
        });
        console.log('Mongoose connection successful!');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
}

// Call the connect function
run().catch(console.dir);

// Handle Mongoose connection events
mongoose.connection.on('error', err => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    await client.close();
    process.exit(0);
});

// Import User model
const User = require('./models/User');

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Session configuration with MongoDB store
const sessionStore = MongoStore.create({
    mongoUrl: uri,
    touchAfter: 24 * 3600,
    ttl: 24 * 60 * 60
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'your_session_secret_here',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// Flash messages
app.use(flash());

// Passport Configuration
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport-Local Strategy
passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await User.findOne({
            $or: [
                { username: username.toLowerCase() },
                { email: username.toLowerCase() }
            ]
        });
        
        if (!user) {
            return done(null, false, { message: 'Invalid username or password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return done(null, false, { message: 'Invalid username or password' });
        }

        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

// Global variables middleware
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.messages = {
        success: req.flash('success'),
        error: req.flash('error'),
        info: req.flash('info')
    };
    next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/events', require('./routes/events'));
app.use('/users', require('./routes/users'));

// 404 handler
app.use((req, res, next) => {
    if (res.headersSent) {
        return next();
    }
    res.status(404).render('404', { 
        title: 'Not Found',
        message: 'Page not found' 
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    if (res.headersSent) {
        return next(err);
    }
    
    const errorDetails = process.env.NODE_ENV === 'development' ? err : {};
    
    res.status(500).render('error', {
        title: 'Server Error',
        message: 'Something went wrong!',
        error: errorDetails,
        stack: process.env.NODE_ENV === 'development' ? err.stack : ''
    });
});

// Start server only after database connection
mongoose.connection.once('open', () => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Visit http://localhost:${PORT} to access the application`);
    });
}); 