import { useState, useEffect, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { QRCodeCanvas } from 'qrcode.react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const WORKER_URL_FALLBACK = import.meta.env.VITE_WORKER_URL || 'https://your-worker.workers.dev';

function App() {
  const [mappings, setMappings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMapping, setEditingMapping] = useState(null); // Use this for both create and edit
  const [qrCodeValue, setQrCodeValue] = useState(null);
  const [shortUrlHost, setShortUrlHost] = useState(
    () => localStorage.getItem('shortUrlHost') || WORKER_URL_FALLBACK
  );

  useEffect(() => {
    localStorage.setItem('shortUrlHost', shortUrlHost);
  }, [shortUrlHost]);

  const fetchMappings = async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const url = force ? `${API_BASE_URL}/mappings?force=true` : `${API_BASE_URL}/mappings`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success) {
        // Ensure mappings have all expected fields
        const sanitizedMappings = result.data.map(m => ({
          shortCode: m.shortCode || '',
          longUrl: m.longUrl || '',
          utm_source: m.utm_source || '',
          utm_medium: m.utm_medium || '',
          utm_campaign: m.utm_campaign || '',
        }));
        setMappings(sanitizedMappings);
      } else {
        throw new Error(result.error || 'Failed to fetch mappings.');
      }
    } catch (err) {
      setError(err.message);
      setMappings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMappings(false);
  }, []);

  const handleShowCreateModal = () => {
    setEditingMapping({}); // Open modal with empty object for creation
  };

  const handleShowEditModal = (mapping) => {
    setEditingMapping(mapping); // Open modal with existing mapping data
  };

  const handleModalClose = () => {
    setEditingMapping(null);
  };

  const handleCreate = async (formData) => {
    const shortCode = formData.customShortCode || nanoid(6);
    const newMapping = { ...formData, shortCode };

    // Optimistic UI update
    setMappings(prev => [...prev, newMapping]);
    handleModalClose();

    try {
      const response = await fetch(`${API_BASE_URL}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMapping),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to create mapping.');
      }
    } catch (err) {
      setError(err.message);
      // Revert the optimistic update on error
      setMappings(prev => prev.filter(m => m.shortCode !== shortCode));
    }
  };

  const handleUpdate = async (formData) => {
    const { shortCode } = formData;
    const originalMappings = mappings;

    // Optimistic UI update
    setMappings(prev => prev.map(m => m.shortCode === shortCode ? formData : m));
    handleModalClose();

    try {
      const response = await fetch(`${API_BASE_URL}/mappings/${shortCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update mapping.');
      }
    } catch (err) {
      setError(err.message);
      // Revert the optimistic update on error
      setMappings(originalMappings);
    }
  };

  const handleDelete = async (shortCode) => {
    if (window.confirm(`Are you sure you want to delete the short URL "${shortCode}"?`)) {
      const originalMappings = mappings;
      // Optimistic UI update
      setMappings(prev => prev.filter(m => m.shortCode !== shortCode));

      try {
        const response = await fetch(`${API_BASE_URL}/mappings/${shortCode}`, { method: 'DELETE' });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to delete mapping.');
        }
      } catch (err) {
        setError(err.message);
        // Revert the optimistic update on error
        setMappings(originalMappings);
      }
    }
  };

  const filteredMappings = useMemo(() => {
    return mappings.filter(m =>
      m.shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.longUrl && m.longUrl.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [mappings, searchTerm]);

  return (
    <div className="container">
      <Header />
      <main>
        <SettingsBar
          host={shortUrlHost}
          onHostChange={(e) => setShortUrlHost(e.target.value)}
        />
        <Toolbar 
          onRefresh={() => fetchMappings(true)} 
          onShowCreateModal={handleShowCreateModal}
          searchTerm={searchTerm}
          onSearchTermChange={e => setSearchTerm(e.target.value)}
        />
        {error && <div className="alert alert-danger mt-3"><strong>Error:</strong> {error}</div>}
        {isLoading && <Spinner />}
        {!isLoading && !error && (
          <MappingTable 
            mappings={filteredMappings} 
            onDelete={handleDelete}
            onEdit={handleShowEditModal}
            onShowQrCode={(shortCode) => setQrCodeValue(`${shortUrlHost}/${shortCode}`)} 
          />
        )}
      </main>
      {editingMapping && (
        <LinkModal 
          initialData={editingMapping}
          onClose={handleModalClose} 
          onSave={editingMapping.shortCode ? handleUpdate : handleCreate}
          existingShortCodes={mappings.map(m => m.shortCode)}
        />
      )}
      {qrCodeValue && (
        <QrCodeModal 
          url={qrCodeValue}
          onClose={() => setQrCodeValue(null)}
        />
      )}
    </div>
  );
}

const SettingsBar = ({ host, onHostChange }) => (
  <div className="mb-3 p-3 bg-light border rounded">
    <div className="row align-items-center">
      <div className="col-md-3">
        <label htmlFor="shortUrlHost" className="form-label fw-bold">Short URL Hostname:</label>
      </div>
      <div className="col-md-9">
        <input
          type="text"
          className="form-control form-control-sm font-monospace"
          id="shortUrlHost"
          value={host}
          onChange={onHostChange}
          placeholder="e.g., https://your-domain.com"
        />
      </div>
    </div>
  </div>
);

const Header = () => (
  <header className="text-center my-4">
    <h1>🔗 URL Shortener Manager</h1>
    <p className="text-muted">A local web UI for managing your Cloudflare URL shortener.</p>
  </header>
);

const Toolbar = ({ onRefresh, onShowCreateModal, searchTerm, onSearchTermChange }) => (
  <div className="d-flex flex-nowrap justify-content-between align-items-center mb-3 p-3 bg-light border rounded gap-2">
    <div className="btn-toolbar" role="toolbar" aria-label="Toolbar with button groups">
      <div className="btn-group me-2" role="group" aria-label="Actions group">
        <button className="btn btn-primary" onClick={onShowCreateModal} title="Create New Short URL">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-plus-lg" viewBox="0 0 16 16" style={{ verticalAlign: 'text-bottom' }}>
            <path fillRule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
          </svg> Create New
        </button>
        <button className="btn btn-secondary" onClick={onRefresh} title="Refresh Mappings from Server">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-clockwise" viewBox="0 0 16 16" style={{ verticalAlign: 'text-bottom' }}>
            <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
          </svg> Refresh
        </button>
      </div>
    </div>
    <div className="ms-md-auto">
      <input
        type="search"
        className="form-control form-control-sm"
        placeholder="Search mappings..."
        value={searchTerm}
        onChange={onSearchTermChange}
      />
    </div>
  </div>
);

const MappingTable = ({ mappings, onDelete, onEdit, onShowQrCode }) => {
  if (mappings.length === 0) {
    return <div className="alert alert-info">No URL mappings found.</div>;
  }
  return (
    <div className="table-responsive border rounded">
      <table className="table table-striped table-hover mb-0">
        <thead className="table-dark">
          <tr>
            <th>Short Code</th>
            <th>Long URL</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((mapping) => (
            <tr key={mapping.shortCode}>
              <td className="font-monospace">{mapping.shortCode}</td>
              <td className="text-truncate" style={{ maxWidth: '30vw' }}>
                <a href={mapping.longUrl} target="_blank" rel="noopener noreferrer">{mapping.longUrl}</a>
              </td>
              <td className="text-end d-flex justify-content-end flex-nowrap gap-2">
                <button 
                  className="btn btn-outline-secondary btn-sm me-2" 
                  onClick={() => onShowQrCode(mapping.shortCode)}
                  title="Show QR Code"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-qr-code-scan" viewBox="0 0 16 16" style={{ verticalAlign: 'text-bottom' }}>
                    <path d="M0 .5A.5.5 0 0 1 .5 0h3a.5.5 0 0 1 0 1H1v2.5a.5.5 0 0 1-1 0v-3Zm12 0a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V1h-2.5a.5.5 0 0 1-.5-.5ZM.5 12a.5.5 0 0 1 .5.5V15h2.5a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5Zm15 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1H15v-2.5a.5.5 0 0 1 .5-.5ZM4 4h1v1H4V4Z"/>
                    <path d="M7 2H2v5h5V2ZM3 3h3v3H3V3Zm2 8H4v1h1v-1Z"/>
                    <path d="M7 9H2v5h5V9Zm-4 1h3v3H3v-3Zm8-6h1v1h-1V4Z"/>
                    <path d="M9 2h5v5H9V2Zm1 1v3h3V3h-3ZM8 8v2h1v1H8v1h2v-2h1v2h1v-1h2v-1h-1V8h-1V7h-1v1h-1v1H8Z"/>
                    <path d="M12 9h2V8h-2v1Z"/>
                  </svg>
                </button>
                <button className="btn btn-outline-primary btn-sm me-2" onClick={() => onEdit(mapping)} title="Edit Short URL">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-pencil" viewBox="0 0 16 16" style={{ verticalAlign: 'text-bottom' }}>
                    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                  </svg>
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(mapping.shortCode)} title="Delete Short URL">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-trash" viewBox="0 0 16 16" style={{ verticalAlign: 'text-bottom' }}>
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z"/>
                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z"/>
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LinkModal = ({ initialData, onClose, onSave, existingShortCodes }) => {
  const [formData, setFormData] = useState({
    longUrl: '',
    customShortCode: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    ...initialData,
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!initialData.shortCode;

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // --- Validation ---
    if (!formData.longUrl) {
      setError('Long URL cannot be empty.');
      return;
    }
    if (!formData.longUrl.startsWith('http://') && !formData.longUrl.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }
    if (formData.customShortCode && !/^[a-zA-Z0-9_-]+$/.test(formData.customShortCode)) {
      setError('Short code can only contain letters, numbers, hyphens, and underscores.');
      return;
    }
    if (!isEditMode && existingShortCodes.includes(formData.customShortCode)) {
      setError('This short code already exists.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      // No need to call onClose here, as the parent component will handle it.
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1">
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{isEditMode ? 'Edit Short URL' : 'Create New Short URL'}</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={isSubmitting}></button>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
              <fieldset disabled={isSubmitting}>
                <div className="mb-3">
                  <label htmlFor="longUrl" className="form-label">Long URL</label>
                  <input
                    type="url"
                    className="form-control"
                    id="longUrl"
                    value={formData.longUrl}
                    onChange={handleChange}
                    placeholder="https://example.com/my-very-long-url"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="customShortCode" className="form-label">
                    {isEditMode ? 'Short Code' : 'Custom Short Code (Optional)'}
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="customShortCode"
                    value={isEditMode ? initialData.shortCode : formData.customShortCode}
                    onChange={handleChange}
                    placeholder={isEditMode ? '' : 'my-custom-code (or leave blank)'}
                    disabled={isEditMode}
                  />
                </div>
                <hr />
                <h6 className="text-muted">UTM Parameters (Optional)</h6>
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label htmlFor="utm_source" className="form-label">UTM Source</label>
                    <input type="text" className="form-control" id="utm_source" value={formData.utm_source} onChange={handleChange} placeholder="e.g., google" />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label htmlFor="utm_medium" className="form-label">UTM Medium</label>
                    <input type="text" className="form-control" id="utm_medium" value={formData.utm_medium} onChange={handleChange} placeholder="e.g., cpc" />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label htmlFor="utm_campaign" className="form-label">UTM Campaign</label>
                    <input type="text" className="form-control" id="utm_campaign" value={formData.utm_campaign} onChange={handleChange} placeholder="e.g., summer_sale" />
                  </div>
                </div>
              </fieldset>
              <div className="d-flex justify-content-end">
                <button type="button" className="btn btn-secondary me-2" onClick={onClose} disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting && (
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  )}
                  {isSubmitting ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const QrCodeModal = ({ url, onClose }) => (
  <div className="modal show d-block" tabIndex="-1">
    <div className="modal-dialog">
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">QR Code</h5>
          <button type="button" className="btn-close" onClick={onClose}></button>
        </div>
        <div className="modal-body text-center">
          <QRCodeCanvas value={url} size={256} />
          <p className="mt-3 font-monospace">{url}</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  </div>
);

const Spinner = () => (
  <div className="loading-spinner">
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

export default App;
