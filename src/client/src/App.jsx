import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout components
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';

// Pages
import Dashboard from './pages/Dashboard/Dashboard';
import CustomerList from './pages/Customers/CustomerList';
import CustomerDetail from './pages/Customers/CustomerDetail';
import CustomerForm from './pages/Customers/CustomerForm';
import VehicleList from './pages/Vehicles/VehicleList';
import VehicleDetail from './pages/Vehicles/VehicleDetail';
import VehicleForm from './pages/Vehicles/VehicleForm';
import WorkOrderList from './pages/WorkOrders/WorkOrderList';
import WorkOrderDetail from './pages/WorkOrders/WorkOrderDetail';
import WorkOrderForm from './pages/WorkOrders/WorkOrderForm';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

// Auth Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Private Route Component
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* App Routes with Layout */}
          <Route path="/*" element={
            <PrivateRoute>
              <div className="flex h-screen bg-gray-100">
                <Sidebar />
                <div className="flex flex-col flex-1 overflow-hidden">
                  <Navbar />
                  <main className="flex-1 overflow-y-auto p-4">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      
                      {/* Customer Routes */}
                      <Route path="/customers" element={<CustomerList />} />
                      <Route path="/customers/new" element={<CustomerForm />} />
                      <Route path="/customers/:id" element={<CustomerDetail />} />
                      <Route path="/customers/:id/edit" element={<CustomerForm />} />
                      
                      {/* Vehicle Routes */}
                      <Route path="/vehicles" element={<VehicleList />} />
                      <Route path="/vehicles/new" element={<VehicleForm />} />
                      <Route path="/vehicles/:id" element={<VehicleDetail />} />
                      <Route path="/vehicles/:id/edit" element={<VehicleForm />} />
                      
                      {/* Work Order Routes */}
                      <Route path="/work-orders" element={<WorkOrderList />} />
                      <Route path="/work-orders/new" element={<WorkOrderForm />} />
                      <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
                      <Route path="/work-orders/:id/edit" element={<WorkOrderForm />} />
                      
                      {/* Fallback - Redirect to Dashboard */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
              </div>
            </PrivateRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;