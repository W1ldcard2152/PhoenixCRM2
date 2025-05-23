import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import SelectInput from '../../components/common/SelectInput';
import WorkOrderService from '../../services/workOrderService';

const WorkOrderList = () => {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showInvoicedTable, setShowInvoicedTable] = useState(false); // Added for collapsible invoiced table
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get filter parameters from URL
  const customerParam = searchParams.get('customer');
  const vehicleParam = searchParams.get('vehicle');
  const needsSchedulingParam = searchParams.get('needsScheduling') === 'true';

  useEffect(() => {
    const fetchWorkOrders = async () => {
      try {
        setLoading(true);
        
        // Build filter object based on URL parameters
        const filters = {};
        if (customerParam) filters.customer = customerParam;
        if (vehicleParam) filters.vehicle = vehicleParam;
        if (statusFilter) filters.status = statusFilter;
        
        const response = await WorkOrderService.getAllWorkOrders(filters);
        const sortedWorkOrders = response.data.workOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
        setWorkOrders(sortedWorkOrders);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching work orders:', err);
        setError('Failed to load work orders. Please try again later.');
        setLoading(false);
      }
    };

    fetchWorkOrders();
  }, [customerParam, vehicleParam, statusFilter]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      // If search query is empty, fetch all work orders with current filters
      try {
        setIsSearching(true);
        
        const filters = {};
        if (customerParam) filters.customer = customerParam;
        if (vehicleParam) filters.vehicle = vehicleParam;
        if (statusFilter) filters.status = statusFilter;
        
        const response = await WorkOrderService.getAllWorkOrders(filters);
        const sortedWorkOrders = response.data.workOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
        setWorkOrders(sortedWorkOrders);
        
        setIsSearching(false);
      } catch (err) {
        console.error('Error fetching work orders:', err);
        setError('Failed to load work orders. Please try again later.');
        setIsSearching(false);
      }
      return;
    }

    try {
      setIsSearching(true);
      const response = await WorkOrderService.searchWorkOrders(searchQuery);
      const sortedWorkOrders = response.data.workOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
      setWorkOrders(sortedWorkOrders);
      setIsSearching(false);
    } catch (err) {
      console.error('Error searching work orders:', err);
      setError('Failed to search work orders. Please try again later.');
      setIsSearching(false);
    }
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
  };

  // Status options for filter dropdown
  const statusOptions = [
    { value: '', label: 'All Statuses' },
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

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Created':
        return 'bg-gray-100 text-gray-800';
      case 'Scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'In Progress':
        return 'bg-indigo-100 text-indigo-800';
      case 'Inspected - Need Parts Ordered':
        return 'bg-yellow-100 text-yellow-800';
      case 'Parts Ordered':
        return 'bg-orange-100 text-orange-800'; // Using orange for parts ordered
      case 'Parts Received':
        return 'bg-lime-100 text-lime-800'; // Using lime for parts received
      case 'Repair In Progress':
        return 'bg-purple-100 text-purple-800';
      case 'Completed - Need Payment':
        return 'bg-teal-100 text-teal-800'; // Using teal for need payment
      case 'Completed - Paid':
        return 'bg-green-100 text-green-800';
      case 'On Hold':
        return 'bg-pink-100 text-pink-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      case 'Invoiced': // Added status for Invoiced
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to display service description, handling both the new
  // services array and the legacy serviceRequested field
  const getServiceDisplay = (workOrder) => {
    if (workOrder.services && workOrder.services.length > 0) {
      return (
        <div>
          {/* Show first service and indicate if there are more */}
          <span>{workOrder.services[0].description}</span>
          {workOrder.services.length > 1 && (
            <span className="text-xs ml-1 text-primary-600">
              (+{workOrder.services.length - 1} more)
            </span>
          )}
        </div>
      );
    } else {
      // Handle legacy format and potentially newline separated services
      if (workOrder.serviceRequested && workOrder.serviceRequested.includes('\n')) {
        const services = workOrder.serviceRequested.split('\n').filter(s => s.trim());
        return (
          <div>
            <span>{services[0]}</span>
            {services.length > 1 && (
              <span className="text-xs ml-1 text-primary-600">
                (+{services.length - 1} more)
              </span>
            )}
          </div>
        );
      }
      
      // Simple single service
      return workOrder.serviceRequested || 'No service specified';
    }
  };

  // Filter work orders into active and invoiced
  const activeWorkOrders = workOrders.filter(wo => wo.status !== 'Invoiced');
  const invoicedWorkOrders = workOrders.filter(wo => wo.status === 'Invoiced');

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Work Orders</h1>
        <Button to="/work-orders/new" variant="primary">
          Create Work Order
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <Card>
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Input
              placeholder="Search by service type, notes, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="mt-1 block w-full"
            />
          </div>
          <div className="flex">
            <SelectInput
              name="statusFilter"
              options={statusOptions}
              value={statusFilter}
              onChange={handleStatusChange}
              className="flex-grow"
            />
            <Button
              onClick={handleSearch}
              variant="secondary"
              className="ml-2"
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <p>Loading work orders...</p>
          </div>
        ) : activeWorkOrders.length === 0 && !statusFilter && !searchQuery && invoicedWorkOrders.length === 0 ? ( // Adjusted condition for initial empty state
          <div className="text-center py-6 text-gray-500">
            <p>No work orders found.</p>
          </div>
        ) : activeWorkOrders.length === 0 && (statusFilter || searchQuery) ? ( // Adjusted condition for empty state after filter/search
            <div className="text-center py-6 text-gray-500">
              <p>No active work orders match your criteria.</p>
            </div>
        ) : activeWorkOrders.length > 0 ? ( // Render table if active work orders exist
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer & Vehicle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeWorkOrders.map((workOrder) => (
                  <tr key={workOrder._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(workOrder.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {workOrder.customer?.name || 'Unknown Customer'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {workOrder.vehicle?.year} {workOrder.vehicle?.make} {workOrder.vehicle?.model}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 truncate max-w-xs">
                        {getServiceDisplay(workOrder)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(workOrder.status)}`}
                      >
                        {workOrder.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {workOrder.status.includes('Completed') 
                          ? formatCurrency(workOrder.totalActual)
                          : formatCurrency(workOrder.totalEstimate)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {workOrder.status.includes('Completed') 
                          ? 'Final'
                          : 'Estimate'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Button
                          to={`/work-orders/${workOrder._id}`}
                          variant="outline"
                          size="sm"
                        >
                          View
                        </Button>
                        <Button
                          to={`/work-orders/${workOrder._id}/edit`}
                          variant="outline"
                          size="sm"
                        >
                          Edit
                        </Button>
                        {needsSchedulingParam && (
                          <Button
                            onClick={() => navigate(`/appointments/new?workOrderId=${workOrder._id}&vehicleId=${workOrder.vehicle?._id}`)}
                            variant="primary"
                            size="sm"
                          >
                            Schedule
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // Show this if activeWorkOrders is empty but it's not the initial load and not due to filters
          // This case might not be hit if the above conditions are comprehensive
          !loading && activeWorkOrders.length === 0 && invoicedWorkOrders.length > 0 && <div className="text-center py-6 text-gray-500"><p>No active work orders.</p></div>
        )}
      </Card>

      {/* Collapsible Table for Invoiced Work Orders */}
      {invoicedWorkOrders.length > 0 || showInvoicedTable ? ( // Render this section if there are invoiced orders or if it's manually toggled open (even if empty after a filter)
        <Card className="mt-6">
          <div 
            className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => setShowInvoicedTable(!showInvoicedTable)}
          >
            <h2 className="text-xl font-semibold text-gray-700">
              Invoiced Work Orders ({invoicedWorkOrders.length})
            </h2>
            <span className="text-sm font-medium text-primary-600">
              {showInvoicedTable ? 'Collapse' : 'Expand'}
              {showInvoicedTable ? 
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline ml-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg> :
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline ml-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              }
            </span>
          </div>
          {showInvoicedTable && (
            loading ? (
              <div className="flex justify-center items-center h-48 p-4">
                <p>Loading...</p> {/* Should ideally not show if main table is already loaded */}
              </div>
            ) : invoicedWorkOrders.length === 0 ? (
              <div className="text-center py-6 text-gray-500 p-4">
                <p>No invoiced work orders found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto p-4">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer & Vehicle</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoicedWorkOrders.map((workOrder) => (
                      <tr key={workOrder._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{new Date(workOrder.date).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{workOrder.customer?.name || 'Unknown Customer'}</div>
                          <div className="text-sm text-gray-500">{workOrder.vehicle?.year} {workOrder.vehicle?.make} {workOrder.vehicle?.model}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 truncate max-w-xs">{getServiceDisplay(workOrder)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(workOrder.status)}`}>{workOrder.status}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {workOrder.status.includes('Completed') || workOrder.status === 'Invoiced' // Assuming Invoiced also shows final amount
                              ? formatCurrency(workOrder.totalActual)
                              : formatCurrency(workOrder.totalEstimate)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {workOrder.status.includes('Completed') || workOrder.status === 'Invoiced'
                              ? 'Final'
                              : 'Estimate'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Button to={`/work-orders/${workOrder._id}`} variant="outline" size="sm">View</Button>
                            <Button to={`/work-orders/${workOrder._id}/edit`} variant="outline" size="sm">Edit</Button>
                            {/* Schedule button likely not needed for Invoiced WOs, but keeping for "same style" consistency for now */}
                            {needsSchedulingParam && ( 
                              <Button
                                onClick={() => navigate(`/appointments/new?workOrderId=${workOrder._id}&vehicleId=${workOrder.vehicle?._id}`)}
                                variant="primary"
                                size="sm"
                              >
                                Schedule
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Card>
      ) : null}
    </div>
  );
};

export default WorkOrderList;
