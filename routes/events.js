const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Event = require('../models/Event');
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');
const { mpesaPayment } = require('../utils/mpesa');
const transporter = require('../utils/email');
const Notification = require('../models/Notification');
const { eventFullTemplate } = require('../utils/emailTemplate');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../public/uploads/events');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Update Multer configuration for multiple images
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'public/uploads/events')
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + '-' + file.originalname)
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit per file
        files: 5 // Maximum 5 files
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true)
        } else {
            cb(new Error('Not an image! Please upload images only.'), false)
        }
    }
});

// Get all events with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9; // Number of events per page
        const skip = (page - 1) * limit;

        // Get total count of events
        const totalEvents = await Event.countDocuments();
        const totalPages = Math.ceil(totalEvents / limit);

        // Get events for current page
        const events = await Event.find()
            .populate('creator')
            .sort({ date: 'asc' })
            .skip(skip)
            .limit(limit);

        // Calculate pagination data
        const pagination = {
            currentPage: page,
            totalPages: totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            nextPage: page + 1,
            prevPage: page - 1
        };

        res.render('events/index', {
            title: 'Events',
            events: events,
            currentUser: req.user,
            pagination: pagination
        });
    } catch (error) {
        console.error('Events Index Error:', error);
        req.flash('error', 'Error loading events');
        res.redirect('/');
    }
});

// Create event form
router.get('/create', isAuthenticated, (req, res) => {
    res.render('events/create', {
        title: 'Create Event',
        currentUser: req.user
    });
});

// Update the create route to handle multiple images
router.post('/', isAuthenticated, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'additionalImages', maxCount: 4 }
]), async (req, res) => {
    try {
        const eventData = {
            ...req.body,
            creator: req.user._id,
            isPaid: req.body.price > 0
        };

        // Handle main image
        if (req.files['image']) {
            eventData.image = '/uploads/events/' + req.files['image'][0].filename;
        }

        // Handle additional images
        if (req.files['additionalImages']) {
            eventData.additionalImages = req.files['additionalImages'].map(file => 
                '/uploads/events/' + file.filename
            );
        }

        const event = await Event.create(eventData);

        // Add event to user's created events
        await User.findByIdAndUpdate(req.user._id, {
            $push: { eventsCreated: event._id }
        });

        req.flash('success', 'Event created successfully!');
        res.redirect(`/events/${event._id}`);
    } catch (error) {
        console.error('Event Create Error:', error);
        // Clean up uploaded files if there was an error
        if (req.files) {
            Object.values(req.files).flat().forEach(file => {
                fs.unlinkSync(path.join(uploadDir, file.filename));
            });
        }
        req.flash('error', 'Error creating event');
        res.redirect('/events/create');
    }
});

// View event
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('creator')
            .populate('attendees.user');

        if (!event) {
            req.flash('error', 'Event not found');
            return res.redirect('/events');
        }

        // Check if user is authenticated
        const isAuthenticated = req.isAuthenticated();
        
        // Check if user is the creator
        const isCreator = isAuthenticated && event.creator._id.equals(req.user._id);
        
        // Check if user is attending
        const isAttending = isAuthenticated && event.attendees.some(attendee => 
            attendee.user._id.equals(req.user._id)
        );

        // Check if event is full
        const isFull = event.capacity && event.attendees.length >= event.capacity;

        res.render('events/details', {
            title: event.title,
            event: event,
            currentUser: req.user,
            isAuthenticated: isAuthenticated,
            isCreator: isCreator,
            isAttending: isAttending,
            isFull: isFull
        });
    } catch (error) {
        console.error('Event View Error:', error);
        req.flash('error', 'Error loading event');
        res.redirect('/events');
    }
});

// Edit event form
router.get('/:id/edit', isAuthenticated, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            req.flash('error', 'Event not found');
            return res.redirect('/events');
        }

        if (!event.creator.equals(req.user._id)) {
            req.flash('error', 'Not authorized');
            return res.redirect('/events');
        }

        res.render('events/edit', {
            title: 'Edit Event',
            event: event,
            currentUser: req.user
        });
    } catch (error) {
        console.error('Event Edit Error:', error);
        req.flash('error', 'Error loading event');
        res.redirect('/events');
    }
});

// Update event
router.put('/:id', isAuthenticated, upload.single('image'), async (req, res) => {
    let oldImagePath = null;
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            req.flash('error', 'Event not found');
            return res.redirect('/events');
        }

        if (!event.creator.equals(req.user._id)) {
            req.flash('error', 'Not authorized');
            return res.redirect('/events');
        }

        const updateData = {
            ...req.body,
            isPaid: req.body.price > 0
        };

        // Handle image update
        if (req.file) {
            // Save old image path for deletion after successful update
            if (event.image && !event.image.includes('default-event.jpg')) {
                oldImagePath = path.join(__dirname, '../public', event.image);
            }
            // Store the relative path in the database
            updateData.image = '/uploads/events/' + req.file.filename;
        }

        const updatedEvent = await Event.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true }
        );

        // Delete old image if it exists and was replaced
        if (oldImagePath && fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
        }

        req.flash('success', 'Event updated successfully!');
        res.redirect(`/events/${updatedEvent._id}`);
    } catch (error) {
        console.error('Event Update Error:', error);
        // If there was an error and a new file was uploaded, delete it
        if (req.file) {
            fs.unlinkSync(path.join(uploadDir, req.file.filename));
        }
        req.flash('error', 'Error updating event');
        res.redirect(`/events/${req.params.id}/edit`);
    }
});

// Delete event
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            req.flash('error', 'Event not found');
            return res.redirect('/events');
        }

        if (!event.creator.equals(req.user._id)) {
            req.flash('error', 'Not authorized');
            return res.redirect('/events');
        }

        // Delete event image if it exists and is not the default image
        if (event.image && !event.image.includes('default-event.jpg')) {
            const imagePath = path.join(__dirname, '../public', event.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        // Remove event from creator's events
        await User.findByIdAndUpdate(event.creator, {
            $pull: { eventsCreated: event._id }
        });

        // Remove event from all attendees' attending events
        await User.updateMany(
            { 'attendingEvents.event': event._id },
            { $pull: { attendingEvents: { event: event._id } } }
        );

        // Finally delete the event
        await Event.findByIdAndDelete(event._id);

        req.flash('success', 'Event deleted successfully!');
        res.redirect('/events');
    } catch (error) {
        console.error('Event Delete Error:', error);
        req.flash('error', 'Error deleting event');
        res.redirect('/events');
    }
});

// RSVP to event
router.post('/:id/rsvp', isAuthenticated, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('creator');
        const user = await User.findById(req.user._id);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // Check if event is full
        if (event.checkCapacity()) {
            return res.status(400).json({ success: false, message: 'Event is full' });
        }

        // Add attendee and check if event becomes full
        event.attendees.push({
            user: req.user._id,
            paymentStatus: event.isPaid ? 'pending' : 'paid'
        });

        // Check if event just became full
        const justBecameFull = event.checkCapacity();
        await event.save();

        // If event just became full, notify creator
        if (justBecameFull) {
            // Send email to creator
            await transporter.sendMail({
                from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
                to: event.creator.email,
                subject: `Your Event "${event.title}" is Now Full`,
                html: eventFullTemplate(event.creator.name, event.title, event.attendees.length)
            });

            // Create notification
            await Notification.create({
                user: event.creator._id,
                type: 'EVENT_FULL',
                message: `Your event "${event.title}" has reached maximum capacity`,
                link: `/events/${event._id}`
            });
        }

        // Process payment if event is paid
        if (event.isPaid) {
            try {
                const paymentResult = await mpesaPayment(req.body.phone, event.price);
                
                // Add user to attendees with pending payment status
                event.attendees.push({
                    user: req.user._id,
                    paymentStatus: 'pending',
                    paymentReference: paymentResult.CheckoutRequestID
                });
                await event.save();

                // Add event to user's attending events
                user.attendingEvents.push({
                    event: event._id,
                    paymentStatus: 'pending',
                    paymentReference: paymentResult.CheckoutRequestID
                });
                await user.save();

                return res.json({
                    success: true,
                    message: 'Payment initiated. Please complete the payment on your phone.',
                    paymentReference: paymentResult.CheckoutRequestID
                });
            } catch (error) {
                console.error('Payment Error:', error);
                return res.status(500).json({ success: false, message: 'Payment processing failed' });
            }
        }

        // For free events, add user directly with paid status
        event.attendees.push({
            user: req.user._id,
            paymentStatus: 'paid'
        });
        await event.save();

        // Add event to user's attending events
        user.attendingEvents.push({
            event: event._id,
            paymentStatus: 'paid'
        });
        await user.save();

        res.json({ success: true, message: 'Successfully RSVP\'d to event' });
    } catch (error) {
        console.error('RSVP Error:', error);
        res.status(500).json({ success: false, message: 'Error processing RSVP' });
    }
});

// Cancel RSVP
router.delete('/:id/rsvp', isAuthenticated, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        const user = await User.findById(req.user._id);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // Remove user from event attendees
        event.attendees = event.attendees.filter(attendee => 
            !attendee.user.equals(req.user._id)
        );
        await event.save();

        // Remove event from user's attending events
        user.attendingEvents = user.attendingEvents.filter(attendance => 
            !attendance.event.equals(event._id)
        );
        await user.save();

        res.json({ success: true, message: 'Successfully cancelled RSVP' });
    } catch (error) {
        console.error('Cancel RSVP Error:', error);
        res.status(500).json({ success: false, message: 'Error cancelling RSVP' });
    }
});

module.exports = router;





