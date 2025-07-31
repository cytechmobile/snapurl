import { useState, useEffect, useMemo } from 'react';
import { nanoid } from 'nanoid';
import * as QRCode from 'qrcode.react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const API_BASE_URL = 'http://localhost:3001/api';
const WORKER_URL = 'https://racket-link-shortener.hostmaster-c9c.workers.dev'; // Base URL for short links

function App() {
  const [mappings, setMappings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState(null); // State for QR code modal

  // Fetch mappings from the local server
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
        setMappings(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch mappings.');
      }
    } catch (err) {
      setError(err.message);
      setMappings([]); // Clear mappings on error
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch mappings on initial component mount
  useEffect(() => {
    fetchMappings(false); // Initial fetch from cache
  }, []);

  const handleDelete = async (shortCode) => {
    if (window.confirm(`Are you sure you want to delete the short URL "${shortCode}"?`)) {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/mappings/${shortCode}`, { method: 'DELETE' });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to delete mapping.');
        }
        // Refresh mappings from server after delete
        await fetchMappings();
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    }
  };

  const handleCreate = async (formData) => {
    setIsLoading(true);
    const shortCode = formData.customShortCode || nanoid(6);
    
    try {
      const response = await fetch(`${API_BASE_URL}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortCode, ...formData }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to create mapping.');
      }
      setShowCreateModal(false);
      await fetchMappings(); // Refresh list
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
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
        <Toolbar 
          onRefresh={() => fetchMappings(true)} 
          onShowCreateModal={() => setShowCreateModal(true)}
          searchTerm={searchTerm}
          onSearchTermChange={e => setSearchTerm(e.target.value)}
        />
        {error && <div className="alert alert-danger mt-3"><strong>Error:</strong> {error}</div>}
        {isLoading && <Spinner />}
        {!isLoading && !error && (
          <MappingTable 
            mappings={filteredMappings} 
            onDelete={handleDelete}
            onShowQrCode={setQrCodeValue} 
          />
        )}
      </main>
      {showCreateModal && (
        <CreateModal 
          onClose={() => setShowCreateModal(false)} 
          onCreate={handleCreate}
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

const Header = () => (
  <header className="text-center my-4">
    <h1>🔗 URL Shortener Manager</h1>
    <p className="text-muted">A local web UI for managing your Cloudflare URL shortener.</p>
  </header>
);

const Toolbar = ({ onRefresh, onShowCreateModal, searchTerm, onSearchTermChange }) => (
  <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 p-3 bg-light border rounded">
    <div className="btn-toolbar">
      <button className="btn btn-primary" onClick={onShowCreateModal}>
        ➕ Create New
      </button>
      <button className="btn btn-secondary" onClick={onRefresh}>
        🔄 Refresh
      </button>
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

const MappingTable = ({ mappings, onDelete, onShowQrCode }) => {
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
          {mappings.map(({ shortCode, longUrl }) => (
            <tr key={shortCode}>
              <td className="font-monospace">{shortCode}</td>
              <td className="text-truncate" style={{ maxWidth: '30vw' }}>
                <a href={longUrl} target="_blank" rel="noopener noreferrer">{longUrl}</a>
              </td>
              <td className="text-end">
                <button 
                  className="btn btn-outline-secondary btn-sm me-2" 
                  onClick={() => onShowQrCode(`${WORKER_URL}/${shortCode}`)}
                >
                  QR
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(shortCode)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CreateModal = ({ onClose, onCreate, existingShortCodes }) => {
  const [formData, setFormData] = useState({
    longUrl: '',
    customShortCode: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
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
    if (existingShortCodes.includes(formData.customShortCode)) {
      setError('This short code already exists.');
      return;
    }
    onCreate(formData);
  };

  return (
    <div className="modal show d-block" tabIndex="-1">
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Create New Short URL</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
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
                <label htmlFor="customShortCode" className="form-label">Custom Short Code (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  id="customShortCode"
                  value={formData.customShortCode}
                  onChange={handleChange}
                  placeholder="my-custom-code (or leave blank)"
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
              <div className="d-flex justify-content-end">
                <button type="button" className="btn btn-secondary me-2" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
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
          <QRCode.default value={url} size={256} />
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