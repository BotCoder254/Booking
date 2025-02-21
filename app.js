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
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const cors = require('cors');
const multer = require('multer');
require('./utils/setupDefaults');

const app = express();

// Replace the environment-based URI with the direct connection string
const uri = "mongodb+srv://stream:telvinteum@stream.o3qip.mongodb.net/?retryWrites=true&w=majority&appName=stream";

// Update the BASE_URL configuration to use environment variable
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Make it available globally
app.locals.BASE_URL = BASE_URL;

// Ensure BASE_URL is available in all routes
app.use((req, res, next) => {
    res.locals.BASE_URL = BASE_URL;
    next();
});

// Add this to test the BASE_URL
app.use((req, res, next) => {
  console.log('Current BASE_URL:', res.locals.BASE_URL);
  next();
});

console.log(`Using BASE_URL: ${BASE_URL}`);

// Create a MongoClient with a MongoClientOptions object
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// DB Config with Mongoose
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
})
.then(async () => {
    try {
        // Connect the client to the server
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("MongoDB Connected Successfully!");
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
    }
})
.catch(err => console.error('MongoDB connection error:', err));

// Import User model
const User = require('./models/User');

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(cors());

// Remove the separate sessionStore configuration and update the session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'KquWbFL6DYB7sw4FxuVXAyZnwbfArT0YpoxF1yNGKZg',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({
        mongoUrl: uri,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60,
        autoRemove: 'native',
        touchAfter: 24 * 3600,
        crypto: {
            secret: process.env.SESSION_SECRET || 'KquWbFL6DYB7sw4FxuVXAyZnwbfArT0YpoxF1yNGKZg'
        }
    }),
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    },
    name: 'streamvista.sid'
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

// Import routes
const mpesaRoutes = require('./routes/mpesa');

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/events', require('./routes/events'));
app.use('/users', require('./routes/users'));
app.use('/api/mpesa', mpesaRoutes);

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

// Add this before your general error handler
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            req.flash('error', 'File is too large. Maximum size is 5MB');
            return res.redirect('back');
        }
    }
    next(err);
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

// Add at the end of app.js, after all your routes and middleware
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});