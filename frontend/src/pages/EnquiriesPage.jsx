import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isSales } = useAuth();

  const [showModal, setShowModal] = useState(false);
  
  // New Customer Form
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ companyName: '', contactPerson: '', mobile: '', city: '' });
  
  // New Enquiry Form
  const [formData, setFormData] = useState({
    enquiryNumber: '', customerId: '', items: [{ productId: '', quantity: 1 }]
  });

  const fetchData = async () => {
    try {
      const [enqRes, custRes, prodRes] = await Promise.all([
        api.get('/enquiries'),
        api.get('/customers'),
        api.get('/inventory') // Doubling as product list
      ]);
      setEnquiries(enqRes.data.enquiries);
      setCustomers(custRes.data.customers);
      setProducts(prodRes.data.inventory);
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customers', newCustomer);
      setShowCustomerModal(false);
      setNewCustomer({ companyName: '', contactPerson: '', mobile: '', city: '' });
      fetchData();
      alert('Customer created');
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating customer');
    }
  };

  const handleCreateEnquiry = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        customerId: parseInt(formData.customerId),
        items: formData.items.map(i => ({ productId: parseInt(i.productId), quantity: parseFloat(i.quantity) }))
      };
      await api.post('/enquiries', payload);
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating enquiry');
    }
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { productId: '', quantity: 1 }] });
  };

  if (loading) return <div>Loading enquiries...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Enquiries</h1>
        {isSales && (
          <div className="space-x-4">
            <button onClick={() => setShowCustomerModal(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
              + New Customer
            </button>
            <button onClick={() => setShowModal(true)} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded">
              + New Enquiry
            </button>
          </div>
        )}
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {enquiries.map(enq => (
              <tr key={enq.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{enq.enquiryNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{enq.customer?.companyName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(enq.enquiryDate).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {enq.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">New Customer</h2>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <input required placeholder="Company Name" className="border w-full p-2 rounded" value={newCustomer.companyName} onChange={e => setNewCustomer({...newCustomer, companyName: e.target.value})} />
              <input required placeholder="Contact Person" className="border w-full p-2 rounded" value={newCustomer.contactPerson} onChange={e => setNewCustomer({...newCustomer, contactPerson: e.target.value})} />
              <input required placeholder="Mobile" className="border w-full p-2 rounded" value={newCustomer.mobile} onChange={e => setNewCustomer({...newCustomer, mobile: e.target.value})} />
              <input required placeholder="City" className="border w-full p-2 rounded" value={newCustomer.city} onChange={e => setNewCustomer({...newCustomer, city: e.target.value})} />
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowCustomerModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enquiry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">New Enquiry</h2>
            <form onSubmit={handleCreateEnquiry} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input required placeholder="Enquiry Number" className="border p-2 rounded" value={formData.enquiryNumber} onChange={e => setFormData({...formData, enquiryNumber: e.target.value})} />
                <select required className="border p-2 rounded" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}>
                  <option value="">Select Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
              <h3 className="font-bold mt-4">Products</h3>
              {formData.items.map((item, idx) => (
                <div key={idx} className="flex space-x-2">
                  <select required className="border p-2 rounded flex-1" value={item.productId} onChange={e => {
                    const newItems = [...formData.items];
                    newItems[idx].productId = e.target.value;
                    setFormData({...formData, items: newItems});
                  }}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.partName} - {p.partCode}</option>)}
                  </select>
                  <input required type="number" min="1" placeholder="Qty" className="border p-2 rounded w-24" value={item.quantity} onChange={e => {
                    const newItems = [...formData.items];
                    newItems[idx].quantity = e.target.value;
                    setFormData({...formData, items: newItems});
                  }} />
                </div>
              ))}
              <button type="button" onClick={addItem} className="text-primary-600 text-sm font-bold">+ Add Item</button>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded">Create Enquiry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
