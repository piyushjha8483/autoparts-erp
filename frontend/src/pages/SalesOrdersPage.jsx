import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();
  
  // Dispatch Modal state
  const [showDispatch, setShowDispatch] = useState(false);
  const [dispatchData, setDispatchData] = useState({ id: null, dispatchNumber: '', vehicleNumber: '', driverName: '' });

  const fetchData = async () => {
    try {
      const [ordRes, invRes] = await Promise.all([
        api.get('/sales-orders'),
        api.get('/inventory')
      ]);
      setOrders(ordRes.data.salesOrders);
      setInventory(invRes.data.inventory);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const confirmOrder = async (id) => {
    try {
      await api.post(`/sales-orders/${id}/confirm`);
      alert("Order confirmed and inventory reserved.");
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error confirming');
    }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/sales-orders/${dispatchData.id}/dispatch`, {
        dispatchNumber: dispatchData.dispatchNumber,
        dispatchDate: new Date().toISOString(),
        vehicleNumber: dispatchData.vehicleNumber,
        driverName: dispatchData.driverName
      });
      alert("Order dispatched successfully!");
      setShowDispatch(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error dispatching');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Sales Orders</h1>
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action (Admin)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map(so => (
                <tr key={so.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{so.orderNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{so.customer?.companyName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">₹{parseFloat(so.totalAmount).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                      {so.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {isAdmin && so.status === 'PENDING' && (
                      <button onClick={() => confirmOrder(so.id)} className="text-white bg-green-600 px-2 py-1 rounded hover:bg-green-700">Confirm</button>
                    )}
                    {isAdmin && so.status === 'CONFIRMED' && (
                      <button onClick={() => {
                        setDispatchData({ id: so.id, dispatchNumber: '', vehicleNumber: '', driverName: '' });
                        setShowDispatch(true);
                      }} className="text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700">Dispatch</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lg:col-span-1">
        <h1 className="text-xl font-bold text-gray-800 mb-6">Inventory Overview</h1>
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <ul className="divide-y divide-gray-200">
            {inventory.map(inv => (
              <li key={inv.id} className="p-4 flex flex-col space-y-1">
                <span className="font-bold text-gray-900">{inv.partName}</span>
                <span className="text-xs text-gray-500">Physical: {inv.physicalQuantity} | Reserved: {inv.reservedQuantity}</span>
                <span className={`text-sm font-bold ${inv.availableQuantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Available: {inv.availableQuantity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showDispatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Dispatch Order</h2>
            <form onSubmit={handleDispatch} className="space-y-4">
              <input required placeholder="Dispatch Number" className="border w-full p-2 rounded" value={dispatchData.dispatchNumber} onChange={e => setDispatchData({...dispatchData, dispatchNumber: e.target.value})} />
              <input placeholder="Vehicle Number" className="border w-full p-2 rounded" value={dispatchData.vehicleNumber} onChange={e => setDispatchData({...dispatchData, vehicleNumber: e.target.value})} />
              <input placeholder="Driver Name" className="border w-full p-2 rounded" value={dispatchData.driverName} onChange={e => setDispatchData({...dispatchData, driverName: e.target.value})} />
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowDispatch(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Dispatch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
