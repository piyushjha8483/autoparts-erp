import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isSales } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    quotationNumber: '', enquiryId: '', validUntil: '', items: []
  });

  // Convert-to-SO modal state
  const [convertModal, setConvertModal] = useState({ open: false, quotationId: null, quotationNumber: '' });
  const [convertOrderNum, setConvertOrderNum] = useState('');
  const [convertError, setConvertError] = useState('');
  const [convertLoading, setConvertLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [quotRes, enqRes] = await Promise.all([
        api.get('/quotations'),
        api.get('/enquiries')
      ]);
      setQuotations(quotRes.data.quotations);
      setEnquiries(enqRes.data.enquiries.filter(e => e.status !== 'LOST')); // Can only quote open enquiries
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleEnquirySelect = (enqId) => {
    const enq = enquiries.find(e => e.id === parseInt(enqId));
    if (enq) {
      setFormData({
        ...formData,
        enquiryId: enqId,
        items: enq.enquiryItems.map(ei => ({
          productId: ei.productId,
          partName: ei.product?.partName,
          quantity: ei.quantity,
          unitPrice: ei.product?.basePrice || 0,
          discountPercent: 0,
          gstPercent: 18
        }))
      });
    }
  };

  const handleCreateQuotation = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        quotationNumber: formData.quotationNumber,
        enquiryId: parseInt(formData.enquiryId),
        validUntil: new Date(formData.validUntil).toISOString(),
        items: formData.items.map(i => ({
          productId: parseInt(i.productId),
          quantity: parseFloat(i.quantity),
          unitPrice: parseFloat(i.unitPrice),
          discountPercent: parseFloat(i.discountPercent),
          gstPercent: parseFloat(i.gstPercent)
        }))
      };
      await api.post('/quotations', payload);
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating quotation');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/quotations/${id}/status`, { status });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating status');
    }
  };

  const openConvertModal = (id, qNum) => {
    setConvertModal({ open: true, quotationId: id, quotationNumber: qNum });
    setConvertOrderNum('');
    setConvertError('');
  };

  const closeConvertModal = () => {
    setConvertModal({ open: false, quotationId: null, quotationNumber: '' });
    setConvertOrderNum('');
    setConvertError('');
  };

  const handleConfirmConvert = async () => {
    if (!convertOrderNum.trim()) {
      setConvertError('Sales Order Number is required.');
      return;
    }
    setConvertLoading(true);
    setConvertError('');
    try {
      await api.post(`/quotations/${convertModal.quotationId}/convert`, { orderNumber: convertOrderNum.trim() });
      closeConvertModal();
      fetchData();
    } catch (err) {
      setConvertError(err.response?.data?.message || 'Conversion failed. Please try again.');
    } finally {
      setConvertLoading(false);
    }
  };

  if (loading) return <div>Loading quotations...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quotations</h1>
        {isSales && (
          <button onClick={() => setShowModal(true)} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded">
            + New Quotation
          </button>
        )}
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grand Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {quotations.map(quot => (
              <tr key={quot.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{quot.quotationNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{quot.customer?.companyName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">₹{parseFloat(quot.grandTotal).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    {quot.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  {isSales && quot.status === 'DRAFT' && <button onClick={() => updateStatus(quot.id, 'SENT')} className="text-blue-600 hover:text-blue-900">Mark Sent</button>}
                  {isSales && quot.status === 'SENT' && <button onClick={() => updateStatus(quot.id, 'ACCEPTED')} className="text-green-600 hover:text-green-900">Accept</button>}
                  {isSales && quot.status === 'ACCEPTED' && !quot.salesOrder && (
                    <button onClick={() => openConvertModal(quot.id, quot.quotationNumber)} className="text-white bg-indigo-600 px-2 py-1 rounded hover:bg-indigo-700">Convert to SO</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create Quotation</h2>
            <form onSubmit={handleCreateQuotation} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Quotation Number</label>
                  <input required placeholder="e.g. QT-2026-001" className="border p-2 rounded w-full" value={formData.quotationNumber} onChange={e => setFormData({...formData, quotationNumber: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Enquiry</label>
                  <select required className="border p-2 rounded w-full" value={formData.enquiryId} onChange={e => handleEnquirySelect(e.target.value)}>
                    <option value="">Select Enquiry</option>
                    {enquiries.map(e => <option key={e.id} value={e.id}>{e.enquiryNumber} - {e.customer?.companyName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Valid Until</label>
                  <input required type="date" className="border p-2 rounded w-full" value={formData.validUntil} onChange={e => setFormData({...formData, validUntil: e.target.value})} />
                </div>
              </div>

              <h3 className="font-bold mt-4">Items (from Enquiry)</h3>

              {/* Column headers for item fields */}
              {formData.items.length > 0 && (
                <div className="flex space-x-2 items-center px-2">
                  <span className="flex-1 text-xs font-semibold text-gray-400 uppercase">Product</span>
                  <span className="w-20 text-xs font-semibold text-gray-400 uppercase text-center">Quantity</span>
                  <span className="w-24 text-xs font-semibold text-gray-400 uppercase text-center">Unit Price (₹)</span>
                  <span className="w-20 text-xs font-semibold text-gray-400 uppercase text-center">Discount %</span>
                  <span className="w-20 text-xs font-semibold text-gray-400 uppercase text-center">GST %</span>
                </div>
              )}

              <div className="space-y-2">
                {formData.items.map((item, idx) => (
                  <div key={idx} className="flex space-x-2 items-center bg-gray-50 p-2 rounded">
                    <span className="flex-1 font-semibold text-sm">{item.partName}</span>
                    <input required type="number" placeholder="Qty" className="border p-1 rounded w-20 text-center" value={item.quantity} onChange={e => {
                      const newItems = [...formData.items]; newItems[idx].quantity = e.target.value; setFormData({...formData, items: newItems});
                    }} />
                    <input required type="number" placeholder="Price" className="border p-1 rounded w-24 text-center" value={item.unitPrice} onChange={e => {
                      const newItems = [...formData.items]; newItems[idx].unitPrice = e.target.value; setFormData({...formData, items: newItems});
                    }} />
                    <input required type="number" placeholder="0" className="border p-1 rounded w-20 text-center" value={item.discountPercent} onChange={e => {
                      const newItems = [...formData.items]; newItems[idx].discountPercent = e.target.value; setFormData({...formData, items: newItems});
                    }} />
                    <input required type="number" placeholder="18" className="border p-1 rounded w-20 text-center" value={item.gstPercent} onChange={e => {
                      const newItems = [...formData.items]; newItems[idx].gstPercent = e.target.value; setFormData({...formData, items: newItems});
                    }} />
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded">Create Quotation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Convert to Sales Order Modal ── */}
      {convertModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Convert to Sales Order</h2>
            <p className="text-sm text-gray-500 mb-4">
              Quotation: <span className="font-semibold text-gray-700">{convertModal.quotationNumber}</span>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-1">
                Sales Order Number <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                placeholder="e.g. SO-2026-001"
                className="border border-gray-300 rounded w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={convertOrderNum}
                onChange={e => { setConvertOrderNum(e.target.value); setConvertError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleConfirmConvert()}
                disabled={convertLoading}
              />
              {convertError && (
                <p className="text-red-600 text-xs mt-1">{convertError}</p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeConvertModal}
                disabled={convertLoading}
                className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmConvert}
                disabled={convertLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {convertLoading ? 'Converting...' : 'Confirm Conversion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
