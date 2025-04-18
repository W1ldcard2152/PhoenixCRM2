import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import TextArea from '../../components/common/TextArea';
import SelectInput from '../../components/common/SelectInput';
import Button from '../../components/common/Button';
import WorkOrderService from '../../services/workOrderService';
import CustomerService from '../../services/customerService';
import VehicleService from '../../services/vehicleService';

// Validation schema
const WorkOrderSchema = Yup.object().shape({
  customer: Yup.string().required('Customer is required'),
  vehicle: Yup.string().required('Vehicle is required'),
  serviceRequested: Yup.string().required('Service requested is required'),
  priority: Yup.string().required('Priority is required'),
  status: Yup.string().required('Status is required'),
  diagnosticNotes: Yup.string()
});

const WorkOrderForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [workOrder, setWorkOrder] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get parameters from URL
  const customerIdParam = searchParams.get('customer');
  const vehicleIdParam = searchParams.get('vehicle');
  
  const [initialValues, setInitialValues] = useState({
    customer: customerIdParam || '',
    vehicle: vehicleIdParam || '',
    date: new Date().toISOString().split('T')[0],
    serviceRequested: '',
    priority: 'Normal',
    status: 'Created',
    diagnosticNotes: '',
    parts: [],
    labor: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch customers for dropdown
        const customersResponse = await CustomerService.getAllCustomers();
        setCustomers(customersResponse.data.customers || []);
        
        // If editing existing work order, fetch work order data
        if (id) {
          const workOrderResponse = await WorkOrderService.getWorkOrder(id);
          const workOrderData = workOrderResponse.data.workOrder;
          setWorkOrder(workOrderData);
          
          // Set initial form values
          setInitialValues({
            customer: typeof workOrderData.customer === 'object' 
              ? workOrderData.customer._id 
              : workOrderData.customer,
            vehicle: typeof workOrderData.vehicle === 'object' 
              ? workOrderData.vehicle._id 
              : workOrderData.vehicle,
            date: new Date(workOrderData.date).toISOString().split('T')[0],
            serviceRequested: workOrderData.serviceRequested || '',
            priority: workOrderData.priority || 'Normal',
            status: workOrderData.status || 'Created',
            diagnosticNotes: workOrderData.diagnosticNotes || '',
            // Additional fields if needed
            parts: workOrderData.parts || [],
            labor: workOrderData.labor || []
          });
          
          // Load vehicles for the selected customer
          if (workOrderData.customer) {
            await fetchVehiclesForCustomer(
              typeof workOrderData.customer === 'object' 
                ? workOrderData.customer._id 
                : workOrderData.customer
            );
          }
        } else if (customerIdParam) {
          // If customer is specified in URL params, fetch their vehicles
          await fetchVehiclesForCustomer(customerIdParam);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
        setLoading(false);
      }
    };

    fetchData();
  }, [id, customerIdParam, vehicleIdParam]);

  const fetchVehiclesForCustomer = async (customerId) => {
    try {
      const vehiclesResponse = await CustomerService.getCustomerVehicles(customerId);
      setVehicles(vehiclesResponse.data.vehicles || []);
    } catch (err) {
      console.error('Error fetching vehicles for customer:', err);
      setError('Failed to load vehicles for the selected customer.');
    }
  };

  const handleCustomerChange = async (e, setFieldValue) => {
    const customerId = e.target.value;
    setFieldValue('customer', customerId);
    setFieldValue('vehicle', ''); // Reset vehicle when customer changes
    
    if (customerId) {
      try {
        await fetchVehiclesForCustomer(customerId);
      } catch (err) {
        console.error('Error fetching vehicles for customer:', err);
        setError('Failed to load vehicles for the selected customer.');
      }
    } else {
      setVehicles([]); // Clear vehicles if no customer selected
    }
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      if (id) {
        // Update existing work order
        await WorkOrderService.updateWorkOrder(id, values);
      } else {
        // Create new work order
        await WorkOrderService.createWorkOrder(values);
      }
      
      // Redirect to work order list or detail page
      navigate('/work-orders');
    } catch (err) {
      console.error('Error saving work order:', err);
      setError('Failed to save work order. Please try again later.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto flex justify-center items-center h-48">
        <p>Loading data...</p>
      </div>
    );
  }

  // Create customer options for dropdown
  const customerOptions = customers.map(customer => ({
    value: customer._id,
    label: customer.name
  }));

  // Create vehicle options for dropdown
  const vehicleOptions = vehicles.map(vehicle => ({
    value: vehicle._id,
    label: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.licensePlate ? `(${vehicle.licensePlate})` : ''}`
  }));

  // Status options for dropdown
  const statusOptions = [
    { value: 'Created', label: 'Created' },
    { value: 'Scheduled', label: 'Scheduled' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Inspected - Need Parts Ordered', label: 'Inspected - Need Parts' },
    { value: 'Parts Ordered', label: 'Parts Ordered' },
    { value: 'Parts Received', label: 'Parts Received' },
    { value: 'Repair In Progress', label: 'Repair In Progress' },
    { value: 'Completed - Need Payment', label: 'Completed - Need Payment' },
    { value: 'Completed - Paid', label: 'Completed - Paid' },
    { value: 'On Hold', label: 'On Hold' },
    { value: 'Cancelled', label: 'Cancelled' }
  ];

  // Priority options for dropdown
  const priorityOptions = [
    { value: 'Low', label: 'Low' },
    { value: 'Normal', label: 'Normal' },
    { value: 'High', label: 'High' },
    { value: 'Urgent', label: 'Urgent' }
  ];

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {id ? 'Edit Work Order' : 'Create New Work Order'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <Card>
        <Formik
          initialValues={initialValues}
          validationSchema={WorkOrderSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ isSubmitting, touched, errors, values, handleChange, handleBlur, setFieldValue }) => (
            <Form>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <SelectInput
                    label="Customer"
                    name="customer"
                    options={customerOptions}
                    value={values.customer}
                    onChange={(e) => handleCustomerChange(e, setFieldValue)}
                    onBlur={handleBlur}
                    error={errors.customer}
                    touched={touched.customer}
                    required
                  />
                </div>
                
                <div>
                  <SelectInput
                    label="Vehicle"
                    name="vehicle"
                    options={vehicleOptions}
                    value={values.vehicle}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.vehicle}
                    touched={touched.vehicle}
                    disabled={!values.customer}
                    required
                  />
                </div>
                
                <div>
                  <Input
                    label="Date"
                    name="date"
                    type="date"
                    value={values.date}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.date}
                    touched={touched.date}
                    required
                  />
                </div>
                
                <div>
                  <SelectInput
                    label="Priority"
                    name="priority"
                    options={priorityOptions}
                    value={values.priority}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.priority}
                    touched={touched.priority}
                    required
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Input
                    label="Service Requested"
                    name="serviceRequested"
                    value={values.serviceRequested}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.serviceRequested}
                    touched={touched.serviceRequested}
                    required
                  />
                </div>
                
                <div>
                  <SelectInput
                    label="Status"
                    name="status"
                    options={statusOptions}
                    value={values.status}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.status}
                    touched={touched.status}
                    required
                  />
                </div>
                
                <div className="md:col-span-2">
                  <TextArea
                    label="Diagnostic Notes"
                    name="diagnosticNotes"
                    value={values.diagnosticNotes}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.diagnosticNotes}
                    touched={touched.diagnosticNotes}
                    rows={4}
                  />
                </div>
              </div>
              
              {id && (
                <div className="mt-6 text-gray-500 text-sm">
                  <p>
                    To add or update parts and labor, please use the Work Order Details page after saving.
                  </p>
                </div>
              )}
              
              <div className="mt-6 flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="light"
                  onClick={() => navigate(id ? `/work-orders/${id}` : '/work-orders')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Work Order'}
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </Card>
    </div>
  );
};

export default WorkOrderForm;