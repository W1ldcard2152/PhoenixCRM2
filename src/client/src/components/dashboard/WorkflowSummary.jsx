// src/client/src/components/dashboard/WorkflowSummary.jsx

import React, { useState, useEffect } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import AppointmentService from '../../services/appointmentService';
import ServiceRequestWizard from '../wizard/ServiceRequestWizard';

/**
 * Modified Workflow Summary Component that shows Today's Appointments
 * instead of Needs Scheduling section
 */
const WorkflowSummary = () => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todayAppointments, setTodayAppointments] = useState([]);

  useEffect(() => {
    fetchWorkflowData();
  }, []);

  const fetchWorkflowData = async () => {
    try {
      setLoading(true);
      
      // Get today's appointments
      const todayApptsResponse = await AppointmentService.getTodayAppointments();
      setTodayAppointments(todayApptsResponse.data.appointments || []);
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching workflow data:', err);
      setError('Failed to load workflow data');
      setLoading(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Card title="Workflow Summary">
        <div className="flex justify-center items-center h-32">
          <p>Loading workflow data...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Workflow Summary">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card 
        title="Workflow Summary" 
        headerActions={
          <Button 
            onClick={() => setIsWizardOpen(true)}
            variant="primary"
            size="sm"
          >
            New Service Request
          </Button>
        }
      >
        <div>
          {/* Today's Appointments */}
          <div>
            <h3 className="font-medium text-lg mb-3 text-gray-700">Today's Appointments</h3>
            {todayAppointments.length === 0 ? (
              <div className="text-center py-4 bg-gray-50 rounded-md text-gray-500">
                <p>No appointments scheduled for today</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {todayAppointments.map((appointment) => (
                  <li key={appointment._id} className="py-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center">
                          <span className="font-medium text-gray-800 mr-2">
                            {formatTime(appointment.startTime)}
                          </span>
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800" // Adjusted styling for technician name
                          >
                            {appointment.technician && appointment.technician.name ? appointment.technician.name : 'Unassigned'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {appointment.customer?.name} • {appointment.vehicle?.year} {appointment.vehicle?.make} {appointment.vehicle?.model}
                        </p>
                        <p className="text-sm text-gray-600">
                          {appointment.serviceType}
                        </p>
                        {/* Technician is now shown where status was */}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          to={`/appointments/${appointment._id}`}
                          variant="outline"
                          size="sm"
                        >
                          View
                        </Button>
                        {appointment.workOrder ? (
                          <Button
                            to={`/work-orders/${typeof appointment.workOrder === 'object' ? appointment.workOrder._id : appointment.workOrder}`}
                            variant="outline"
                            size="sm"
                          >
                            View WO
                          </Button>
                        ) : (
                          <Button
                            to={`/work-orders/new?appointment=${appointment._id}`}
                            variant="primary"
                            size="sm"
                          >
                            Create WO
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
      <ServiceRequestWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
      />
    </>
  );
};

export default WorkflowSummary;
