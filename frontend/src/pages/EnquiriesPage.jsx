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

  // Accordion state: tracks which enquiry row is expanded and its fetched detail
  const [expandedId, setExpandedId] = useState(null);
  const [detailData, setDetailData] = useState({});     // { [enquiryId]: { loading, error, data } }

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

  // Toggle accordion: collapse if same row clicked, else fetch + expand
  const handleRowClick = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    // Only fetch if we don't already have the data cached
    if (detailData[id]) return;

    setDetailData(prev => ({ ...prev, [id]: { loading: true, error: null, data: null } }));
    try {
      const res = await api.get(`/enquiries/${id}`);
      setDetailData(prev => ({ ...prev, [id]: { loading: false, error: null, data: res.data.enquiry } }));
    } catch (err) {
      setDetailData(prev => ({
        ...prev,
        [id]: { loading: false, error: err.response?.data?.message || 'Failed to load enquiry details', data: null }
      }));
    }
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
            {enquiries.map(enq => {
              const isExpanded = expandedId === enq.id;
              const detail = detailData[enq.id];
              return (
                <React.Fragment key={enq.id}>
                  {/* Main row — clicking anywhere on it toggles the accordion */}
                  <tr
                    onClick={() => handleRowClick(enq.id)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-700 underline underline-offset-2">
                      {enq.enquiryNumber}
                      <span className="ml-2 text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{enq.customer?.companyName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(enq.enquiryDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {enq.status}
                      </span>
                    </td>
                  </tr>

                  {/* Accordion detail row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={4} className="px-6 pb-4 pt-0 bg-indigo-50">
                        {detail?.loading && (
                          <p className="text-sm text-gray-500 py-3">Loading details...</p>
                        )}
                        {detail?.error && (
                          <p className="text-sm text-red-600 py-3">{detail.error}</p>
                        )}
                        {detail?.data && (() => {
                          const d = detail.data;
                          return (
                            <div className="border border-indigo-200 rounded-lg bg-white p-4 mt-2 space-y-3">
                              {/* Header fields */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase">Enquiry #</p>
                                  <p className="font-medium text-gray-800">{d.enquiryNumber}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase">Customer</p>
                                  <p className="font-medium text-gray-800">{d.customer?.companyName}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase">Enquiry Date</p>
                                  <p className="font-medium text-gray-800">{new Date(d.enquiryDate).toLocaleDateString()}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase">Required Date</p>
                                  <p className="font-medium text-gray-800">
                                    {d.requiredDate ? new Date(d.requiredDate).toLocaleDateString() : '—'}
                                  </p>
                                </div>
                              </div>

                              {/* Notes */}
                              {d.notes && (
                                <div className="text-sm">
                                  <p className="text-xs font-semibold text-gray-400 uppercase">Notes</p>
                                  <p className="text-gray-700 mt-1">{d.notes}</p>
                                </div>
                              )}

                              {/* Items table */}
                              {d.enquiryItems?.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Products / Items</p>
                                  <table className="min-w-full text-sm border border-gray-200 rounded">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Part Code</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Part Name</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Category</th>
                                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Quantity</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {d.enquiryItems.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 text-gray-700 font-mono">{item.product?.partCode}</td>
                                          <td className="px-3 py-2 text-gray-800 font-medium">{item.product?.partName}</td>
                                          <td className="px-3 py-2 text-gray-500">{item.product?.category}</td>
                                          <td className="px-3 py-2 text-right font-semibold">{parseFloat(item.quantity)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
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
