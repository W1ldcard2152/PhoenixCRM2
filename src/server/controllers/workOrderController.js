const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder');
const Vehicle = require('../models/Vehicle');
const Customer = require('../models/Customer');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const twilioService = require('../services/twilioService');
const emailService = require('../services/emailService');

// Get all work orders
exports.getAllWorkOrders = catchAsync(async (req, res, next) => {
  // Allow filtering by status, customer, vehicle, date range
  const { status, customer, vehicle, startDate, endDate } = req.query;
  
  // Build query based on filters
  const query = {};
  
  if (status) query.status = status;
  if (customer) query.customer = customer;
  if (vehicle) query.vehicle = vehicle;
  
  // Date range filter
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }
  
  const workOrders = await WorkOrder.find(query)
    .populate('customer', 'name phone email')
    .populate('vehicle', 'year make model vin licensePlate')
    .populate('assignedTechnician', 'name specialization') // Populate assignedTechnician
    .sort({ date: -1 });
  
  res.status(200).json({
    status: 'success',
    results: workOrders.length,
    data: {
      workOrders
    }
  });
});

// Get a single work order
exports.getWorkOrder = catchAsync(async (req, res, next) => {
  try {
    // Validate the work order ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError('Invalid work order ID format', 400));
    }
    
    const workOrder = await WorkOrder.findById(req.params.id)
      .populate('customer', 'name phone email')
      .populate('vehicle', 'year make model vin licensePlate')
      .populate({
        path: 'appointmentId',
        select: '_id technician startTime endTime status', // _id first
        populate: { 
          path: 'technician',
          select: '_id name specialization' // _id first
        }
      })
      .populate('assignedTechnician', '_id name specialization'); // _id first
    
    if (!workOrder) {
      return next(new AppError('No work order found with that ID', 404));
    }
    
    // The explicit check and manual population for appointmentId can be removed
    // as Mongoose's populate should handle this correctly with the specified path and select.

    res.status(200).json({
      status: 'success',
      data: {
        workOrder
      }
    });
  } catch (err) {
    console.error(`Error fetching work order ${req.params.id}:`, err);
    return next(new AppError(`Failed to fetch work order details: ${err.message}`, 500));
  }
});

// Create a new work order
exports.createWorkOrder = catchAsync(async (req, res, next) => {
  // Verify that customer and vehicle exist and are related
  const vehicle = await Vehicle.findById(req.body.vehicle);
  
  if (!vehicle) {
    return next(new AppError('No vehicle found with that ID', 404));
  }
  
  const customer = await Customer.findById(req.body.customer);
  
  if (!customer) {
    return next(new AppError('No customer found with that ID', 404));
  }
  
  // Verify that the vehicle belongs to the customer
  if (vehicle.customer.toString() !== customer._id.toString()) {
    return next(
      new AppError('The vehicle does not belong to this customer', 400)
    );
  }
  
  // Handle services array if provided
  let workOrderData = { ...req.body };
  
  if (!workOrderData.services || workOrderData.services.length === 0) {
    // If no services array but serviceRequested is provided, convert to services
    if (workOrderData.serviceRequested) {
      // Split by newlines if there are any
      if (workOrderData.serviceRequested.includes('\n')) {
        workOrderData.services = workOrderData.serviceRequested
          .split('\n')
          .filter(line => line.trim())
          .map(line => ({ description: line.trim() }));
      } else {
        // Single service
        workOrderData.services = [{ description: workOrderData.serviceRequested }];
      }
    } else {
      // Empty services array if nothing provided
      workOrderData.services = [];
    }
  } else if (typeof workOrderData.services === 'string') {
    // Handle case where services might be sent as a string
    try {
      workOrderData.services = JSON.parse(workOrderData.services);
    } catch (e) {
      workOrderData.services = [{ description: workOrderData.services }];
    }
  }
  
  // Generate serviceRequested field for backward compatibility
  if (Array.isArray(workOrderData.services) && workOrderData.services.length > 0) {
    workOrderData.serviceRequested = workOrderData.services
      .map(service => service.description)
      .join('\n');
  }
  
  // Calculate total estimate if parts and labor are provided
  if (workOrderData.parts && workOrderData.parts.length > 0) {
    const partsCost = workOrderData.parts.reduce((total, part) => {
      return total + (part.price * part.quantity);
    }, 0);
    
    if (!workOrderData.totalEstimate) {
      workOrderData.totalEstimate = partsCost;
    }
  }
  
  if (workOrderData.labor && workOrderData.labor.length > 0) {
    const laborCost = workOrderData.labor.reduce((total, labor) => {
      return total + (labor.hours * labor.rate);
    }, 0);
    
    if (!workOrderData.totalEstimate) {
      workOrderData.totalEstimate = (workOrderData.totalEstimate || 0) + laborCost;
    }
  }
  
  const newWorkOrder = await WorkOrder.create(workOrderData);
  
  // Add the work order to the vehicle's service history
  vehicle.serviceHistory.push(newWorkOrder._id);
  
  // Update vehicle mileage if currentMileage is provided
  if (workOrderData.currentMileage && !isNaN(parseFloat(workOrderData.currentMileage))) {
    const mileageValue = parseFloat(workOrderData.currentMileage);
    // Add to mileage history
    vehicle.mileageHistory.push({
      date: workOrderData.date ? new Date(workOrderData.date) : new Date(), // Use WO date or current date
      mileage: mileageValue,
      source: `Work Order #${newWorkOrder.id}` // Optional: add source
    });
    // Update vehicle's main currentMileage
    vehicle.currentMileage = mileageValue;
  }
  
  await vehicle.save({ validateBeforeSave: false });
  
  res.status(201).json({
    status: 'success',
    data: {
      workOrder: newWorkOrder
    }
  });
});

// Update a work order
exports.updateWorkOrder = catchAsync(async (req, res, next) => {
  // Handle services array if provided
  let workOrderData = { ...req.body };
  
  // Process services array
  if (workOrderData.services) {
    // Ensure services is in the correct format
    if (typeof workOrderData.services === 'string') {
      try {
        workOrderData.services = JSON.parse(workOrderData.services);
      } catch (e) {
        workOrderData.services = [{ description: workOrderData.services }];
      }
    }
    
    // Generate serviceRequested field for backward compatibility
    workOrderData.serviceRequested = Array.isArray(workOrderData.services) 
      ? workOrderData.services.map(s => s.description).join('\n')
      : '';
  } else if (workOrderData.serviceRequested) {
    // If serviceRequested is provided but not services, convert to services array
    if (workOrderData.serviceRequested.includes('\n')) {
      workOrderData.services = workOrderData.serviceRequested
        .split('\n')
        .filter(line => line.trim())
        .map(line => ({ description: line.trim() }));
    } else {
      workOrderData.services = [{ description: workOrderData.serviceRequested }];
    }
  }
  
  // Recalculate total estimate/actual if parts or labor changed
  if (workOrderData.parts || workOrderData.labor) {
    const workOrder = await WorkOrder.findById(req.params.id);
    
    if (!workOrder) {
      return next(new AppError('No work order found with that ID', 404));
    }
    
    if (workOrderData.parts) {
      const partsCost = workOrderData.parts.reduce((total, part) => {
        return total + (part.price * part.quantity);
      }, 0);
      
      // Only update totalEstimate if it's not explicitly provided
      if (!workOrderData.totalEstimate) {
        // Calculate labor cost from existing data if not updated
        const laborCost = workOrderData.labor 
          ? workOrderData.labor.reduce((total, labor) => {
              return total + (labor.hours * labor.rate);
            }, 0)
          : workOrder.labor.reduce((total, labor) => {
              return total + (labor.hours * labor.rate);
            }, 0);
            
        workOrderData.totalEstimate = partsCost + laborCost;
      }
    }
    
    if (workOrderData.labor) {
      const laborCost = workOrderData.labor.reduce((total, labor) => {
        return total + (labor.hours * labor.rate);
      }, 0);
      
      // Only update totalEstimate if it's not explicitly provided
      if (!workOrderData.totalEstimate) {
        // Calculate parts cost from existing data if not updated
        const partsCost = workOrderData.parts 
          ? workOrderData.parts.reduce((total, part) => {
              return total + (part.price * part.quantity);
            }, 0)
          : workOrder.parts.reduce((total, part) => {
              return total + (part.price * part.quantity);
            }, 0);
            
        workOrderData.totalEstimate = partsCost + laborCost;
      }
    }
  }
  
  
  // Handle currentMileage update for the vehicle
  if (workOrderData.currentMileage && !isNaN(parseFloat(workOrderData.currentMileage))) {
    const mileageValue = parseFloat(workOrderData.currentMileage);
    const workOrderForVehicle = await WorkOrder.findById(req.params.id).populate('vehicle');
    if (workOrderForVehicle && workOrderForVehicle.vehicle) {
      const vehicleToUpdate = await Vehicle.findById(workOrderForVehicle.vehicle._id);
      if (vehicleToUpdate) {
        // Check if this mileage entry already exists to avoid duplicates from simple re-saves
        const existingMileageEntry = vehicleToUpdate.mileageHistory.find(
          entry => entry.mileage === mileageValue && 
                   new Date(entry.date).toDateString() === new Date(workOrderData.date || new Date()).toDateString() &&
                   (entry.source || '').includes(`Work Order #${req.params.id}`)
        );

        if (!existingMileageEntry) {
           vehicleToUpdate.mileageHistory.push({
            date: workOrderData.date ? new Date(workOrderData.date) : new Date(),
            mileage: mileageValue,
            source: `Work Order #${req.params.id}`
          });
        }
        vehicleToUpdate.currentMileage = mileageValue;
        await vehicleToUpdate.save({ validateBeforeSave: false });
      }
    }
  }
  
  // If status is being updated
  if (workOrderData.status) {
    const oldWorkOrder = await WorkOrder.findById(req.params.id)
      .populate('customer')
      .populate('vehicle');
      
    if (oldWorkOrder && oldWorkOrder.status !== workOrderData.status) {
      // Send notification if status is changing to a notifiable status
      const notifiableStatuses = [
        'Inspected - Need Parts Ordered',
        'Parts Received',
        'Repair In Progress',
        'Completed - Need Payment',
        'Completed - Paid'
      ];
      
      if (notifiableStatuses.includes(workOrderData.status) && 
          oldWorkOrder.customer && 
          oldWorkOrder.vehicle) {
        
        // Send SMS notification if customer prefers SMS
        if (oldWorkOrder.customer.communicationPreference === 'SMS' && 
            oldWorkOrder.customer.phone) {
          try {
            await twilioService.sendStatusUpdate(
              { status: workOrderData.status },
              oldWorkOrder.customer,
              oldWorkOrder.vehicle
            );
          } catch (err) {
            console.error('Failed to send SMS notification:', err);
            // Don't fail the update if notification fails
          }
        }
        
        // Send email notification if customer prefers Email
        if (oldWorkOrder.customer.communicationPreference === 'Email' && 
            oldWorkOrder.customer.email) {
          try {
            // This would require implementing a specific email template for status updates
            // await emailService.sendStatusUpdate(...);
          } catch (err) {
            console.error('Failed to send email notification:', err);
            // Don't fail the update if notification fails
          }
        }
      }
    }
  }
  
  const oldWorkOrder = await WorkOrder.findById(req.params.id); // Get current state for comparison

  // If an appointmentId is present and has a technician, ensure workOrder.assignedTechnician is synced
  if (workOrderData.appointmentId) {
    const Appointment = require('../models/Appointment'); // Ensure Appointment model is available
    const appointment = await Appointment.findById(workOrderData.appointmentId).populate('technician');
    if (appointment && appointment.technician) {
      workOrderData.assignedTechnician = appointment.technician._id;
    }
  } else if (workOrderData.hasOwnProperty('appointmentId') && workOrderData.appointmentId === null) {
    // If appointmentId is explicitly set to null, consider unassigning the technician
    // or leaving it as is, depending on desired logic. For now, we'll let assignedTechnician be managed separately if no appointment.
  }


  const updatedWorkOrderPopulated = await WorkOrder.findByIdAndUpdate(req.params.id, workOrderData, {
    new: true,
    runValidators: true
  }).populate('customer', 'name phone email')
    .populate('vehicle', 'year make model vin licensePlate')
    .populate('assignedTechnician', '_id name specialization') // _id first
    .populate({
        path: 'appointmentId',
        select: '_id technician startTime endTime status', // _id first
        populate: {
          path: 'technician',
          select: '_id name specialization' // _id first
        }
      });

  if (!updatedWorkOrderPopulated) {
    return next(new AppError('No work order found with that ID', 404));
  }
  
  // Sync assignedTechnician if appointmentId and its technician exist
  // This logic is now moved before the update to ensure workOrderData contains the correct technician
  // if (updatedWorkOrderPopulated.appointmentId && updatedWorkOrderPopulated.appointmentId.technician) {
  //   if (!updatedWorkOrderPopulated.assignedTechnician || 
  //       updatedWorkOrderPopulated.assignedTechnician._id.toString() !== updatedWorkOrderPopulated.appointmentId.technician._id.toString()) {
  //     updatedWorkOrderPopulated.assignedTechnician = updatedWorkOrderPopulated.appointmentId.technician._id;
  //     // Re-save if we updated assignedTechnician after the initial update.
  //     // This is not ideal. Better to include in the initial update.
  //     // await updatedWorkOrderPopulated.save({ validateBeforeSave: false });
  //   }
  // }
  
  res.status(200).json({
    status: 'success',
    data: {
      workOrder: updatedWorkOrderPopulated
    }
  });
});

// Delete a work order
exports.deleteWorkOrder = catchAsync(async (req, res, next) => {
  const workOrder = await WorkOrder.findById(req.params.id);
  
  if (!workOrder) {
    return next(new AppError('No work order found with that ID', 404));
  }
  
  // Remove from vehicle's service history
  await Vehicle.findByIdAndUpdate(
    workOrder.vehicle,
    { $pull: { serviceHistory: req.params.id } }
  );
  
  await WorkOrder.findByIdAndDelete(req.params.id);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Update work order status
exports.updateStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  
  if (!status) {
    return next(new AppError('Please provide a status', 400));
  }
  
  const workOrder = await WorkOrder.findById(req.params.id);
  
  if (!workOrder) {
    return next(new AppError('No work order found with that ID', 404));
  }
  
  // Update the status
  workOrder.status = status;
  
  // If the status is "Completed - Paid" or "Invoiced", set the totalActual
  if (status === 'Completed - Paid' || status === 'Invoiced') {
    // Calculate total from parts and labor
    const partsCost = workOrder.parts.reduce((total, part) => {
      return total + (part.price * part.quantity);
    }, 0);
    
    const laborCost = workOrder.labor.reduce((total, labor) => {
      return total + (labor.hours * labor.rate);
    }, 0);
    
    workOrder.totalActual = partsCost + laborCost;
  }
  
  await workOrder.save();
  
  // Get populated work order
  const populatedWorkOrder = await WorkOrder.findById(req.params.id)
    .populate('customer', 'name phone email') // Match getWorkOrder population
    .populate('vehicle', 'year make model vin licensePlate') // Match getWorkOrder population
    .populate('assignedTechnician', '_id name specialization') // Match getWorkOrder population
    .populate({
      path: 'appointmentId',
      select: '_id technician startTime endTime status',
      populate: {
        path: 'technician',
        select: '_id name specialization'
      }
    });
  
  // Send notification if customer has communication preference set
  if (populatedWorkOrder.customer && 
      populatedWorkOrder.customer.communicationPreference !== 'None') {
    
    // For SMS notification
    if (populatedWorkOrder.customer.communicationPreference === 'SMS' && 
        populatedWorkOrder.customer.phone) {
      try {
        await twilioService.sendStatusUpdate(
          populatedWorkOrder,
          populatedWorkOrder.customer,
          populatedWorkOrder.vehicle
        );
      } catch (err) {
        console.error('Failed to send SMS notification:', err);
        // Don't fail the update if notification fails
      }
    }
    
    // For Email notification
    // This would require implementing a specific email template for status updates
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      workOrder: populatedWorkOrder
    }
  });
});

// Add part to work order
exports.addPart = catchAsync(async (req, res, next) => {
  const workOrder = await WorkOrder.findById(req.params.id);
  
  if (!workOrder) {
    return next(new AppError('No work order found with that ID', 404));
  }
  
  // Add the part
  workOrder.parts.push(req.body);
  
  // Recalculate total estimate
  const partsCost = workOrder.parts.reduce((total, part) => {
    return total + (part.price * part.quantity);
  }, 0);
  
  const laborCost = workOrder.labor.reduce((total, labor) => {
    return total + (labor.hours * labor.rate);
  }, 0);
  
  workOrder.totalEstimate = partsCost + laborCost;
  
  await workOrder.save();
  
  // Re-fetch and populate fully to ensure client receives consistent data
  const populatedWorkOrderAfterAdd = await WorkOrder.findById(req.params.id)
    .populate('customer', 'name phone email')
    .populate('vehicle', 'year make model vin licensePlate')
    .populate('assignedTechnician', '_id name specialization')
    .populate({
      path: 'appointmentId',
      select: '_id technician startTime endTime status',
      populate: {
        path: 'technician',
        select: '_id name specialization'
      }
    });

  res.status(200).json({
    status: 'success',
    data: {
      workOrder: populatedWorkOrderAfterAdd
    }
  });
});

// Add labor to work order
exports.addLabor = catchAsync(async (req, res, next) => {
  const workOrder = await WorkOrder.findById(req.params.id);
  
  if (!workOrder) {
    return next(new AppError('No work order found with that ID', 404));
  }
  
  // Add the labor
  workOrder.labor.push(req.body);
  
  // Recalculate total estimate
  const partsCost = workOrder.parts.reduce((total, part) => {
    return total + (part.price * part.quantity);
  }, 0);
  
  const laborCost = workOrder.labor.reduce((total, labor) => {
    return total + (labor.hours * labor.rate);
  }, 0);
  
  workOrder.totalEstimate = partsCost + laborCost;
  
  await workOrder.save();

  // Re-fetch and populate fully to ensure client receives consistent data
  const populatedWorkOrderAfterAddLabor = await WorkOrder.findById(req.params.id)
    .populate('customer', 'name phone email')
    .populate('vehicle', 'year make model vin licensePlate')
    .populate('assignedTechnician', '_id name specialization')
    .populate({
      path: 'appointmentId',
      select: '_id technician startTime endTime status',
      populate: {
        path: 'technician',
        select: '_id name specialization'
      }
    });
  
  res.status(200).json({
    status: 'success',
    data: {
      workOrder: populatedWorkOrderAfterAddLabor
    }
  });
});

// Get work orders by status
exports.getWorkOrdersByStatus = catchAsync(async (req, res, next) => {
  const { status } = req.params;
  
  const workOrders = await WorkOrder.find({ status })
    .populate('customer', 'name phone email')
    .populate('vehicle', 'year make model vin licensePlate')
    .populate('assignedTechnician', 'name specialization') // Populate assignedTechnician
    .sort({ date: -1 });
  
  res.status(200).json({
    status: 'success',
    results: workOrders.length,
    data: {
      workOrders
    }
  });
});

// Generate invoice
exports.generateInvoice = catchAsync(async (req, res, next) => {
  const workOrder = await WorkOrder.findById(req.params.id)
    .populate('customer', 'name email phone address')
    .populate('vehicle', 'year make model vin')
    .populate('assignedTechnician', 'name specialization'); // Populate assignedTechnician
  
  if (!workOrder) {
    return next(new AppError('No work order found with that ID', 404));
  }
  
  // Calculate totals
  const partsCost = workOrder.parts.reduce((total, part) => {
    return total + (part.price * part.quantity);
  }, 0);
  
  const laborCost = workOrder.labor.reduce((total, labor) => {
    return total + (labor.hours * labor.rate);
  }, 0);
  
  const totalCost = partsCost + laborCost;
  
  // In a real application, you would generate a PDF here
  // For now, we'll just return the invoice data
  
  res.status(200).json({
    status: 'success',
    data: {
      invoice: {
        workOrderId: workOrder._id,
        customer: workOrder.customer,
        vehicle: workOrder.vehicle,
        assignedTechnician: workOrder.assignedTechnician, // Include technician in invoice data
        date: workOrder.date,
        parts: workOrder.parts,
        labor: workOrder.labor,
        partsCost,
        laborCost,
        totalCost,
        status: workOrder.status
      }
    }
  });
});

// Search work orders - Updated to search in services array
exports.searchWorkOrders = catchAsync(async (req, res, next) => {
  const { query } = req.query;
  
  if (!query) {
    return next(new AppError('Please provide a search query', 400));
  }
  
  // Search work orders by service requested, services array, status, or diagnostic notes
  const workOrders = await WorkOrder.find({
    $or: [
      { serviceRequested: { $regex: query, $options: 'i' } },
      { 'services.description': { $regex: query, $options: 'i' } }, // Search in services array
      { status: { $regex: query, $options: 'i' } },
      { diagnosticNotes: { $regex: query, $options: 'i' } }
    ]
  })
  .populate('customer', 'name phone email')
  .populate('vehicle', 'year make model vin licensePlate')
  .populate('assignedTechnician', 'name specialization'); // Populate assignedTechnician
  
  res.status(200).json({
    status: 'success',
    results: workOrders.length,
    data: {
      workOrders
    }
  });
});
