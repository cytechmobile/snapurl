import { useState, useEffect, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { QRCodeCanvas } from 'qrcode.react';
import { Container, Box, Typography, Paper, TextField, Button, IconButton, Select, MenuItem, FormControl, InputLabel, CircularProgress, Alert, TablePagination } from '@mui/material';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { AppBar, Toolbar as MuiToolbar } from '@mui/material'; // Renamed Toolbar to MuiToolbar to avoid conflict
import { Add, Refresh, QrCode, Edit, Delete, ArrowUpward, ArrowDownward } from '@mui/icons-material';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const WORKER_URL_FALLBACK = import.meta.env.VITE_WORKER_URL || 'https://your-worker.workers.dev';

function App() {
  const [mappings, setMappings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
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

  const filteredAndSortedMappings = useMemo(() => {
    const filtered = mappings.filter(m =>
      m.shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.longUrl && m.longUrl.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (sortColumn) {
      filtered.sort((a, b) => {
        const aValue = a[sortColumn] || '';
        const bValue = b[sortColumn] || '';
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [mappings, searchTerm, sortColumn, sortDirection]);

  const paginatedMappings = useMemo(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredAndSortedMappings.slice(startIndex, endIndex);
  }, [filteredAndSortedMappings, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSort = (columnId) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Header />
      <Box component="main" sx={{ flexGrow: 1, p: 4 }}>
        <SettingsBar
          host={shortUrlHost}
          onHostChange={(e) => setShortUrlHost(e.target.value)}
        />
        <Toolbar 
          onRefresh={() => fetchMappings(true)} 
          onShowCreateModal={handleShowCreateModal}
          searchTerm={searchTerm}
          onSearchTermChange={e => { setSearchTerm(e.target.value); setPage(0); }}
        />
        {error && <Alert severity="error" sx={{ mt: 3, p: 2, boxShadow: 3 }}><strong>Error:</strong> {error}</Alert>}
        {isLoading && <Spinner />}
        {!isLoading && !error && (
          <MappingTable 
            mappings={paginatedMappings} 
            onDelete={handleDelete}
            onEdit={handleShowEditModal}
            onShowQrCode={(shortCode) => setQrCodeValue(`${shortUrlHost}/${shortCode}`)} 
            page={page}
            rowsPerPage={rowsPerPage}
            totalMappings={filteredAndSortedMappings.length}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
      </Box>
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
    </Container>
  );
}

const SettingsBar = ({ host, onHostChange }) => (
  <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
        Short URL Hostname:
      </Typography>
      <TextField
        id="shortUrlHost"
        variant="outlined"
        size="small"
        value={host}
        onChange={onHostChange}
        placeholder="e.g., https://your-domain.com"
        sx={{ flexGrow: 1 }}
      />
    </Box>
  </Paper>
);

const Header = () => (
  <AppBar position="static" sx={{ mb: 3, boxShadow: 3 }}>
    <MuiToolbar>
      <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
        🔗 URL Shortener Manager
      </Typography>
    </MuiToolbar>
  </AppBar>
);

const Toolbar = ({ onRefresh, onShowCreateModal, searchTerm, onSearchTermChange }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: '4px' }}>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button variant="contained" startIcon={<Add />} onClick={onShowCreateModal}>
        Create New
      </Button>
      <Button variant="outlined" startIcon={<Refresh />} onClick={onRefresh}>
        Refresh
      </Button>
    </Box>
    <TextField
      variant="outlined"
      size="small"
      placeholder="Search mappings..."
      value={searchTerm}
      onChange={onSearchTermChange}
      sx={{ width: '250px' }}
    />
  </Box>
);

const MappingTable = ({ mappings, onDelete, onEdit, onShowQrCode, sortColumn, sortDirection, onSort, page, rowsPerPage, totalMappings, onPageChange, onRowsPerPageChange }) => {
  if (mappings.length === 0) {
    return <Typography variant="body1" sx={{ mt: 3, textAlign: 'center' }}>No URL mappings found.</Typography>;
  }
  return (
    <TableContainer component={Paper} sx={{ mt: 3, p: 2, boxShadow: 3 }}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell onClick={() => onSort('shortCode')} sx={{ cursor: 'pointer', width: '15%' }}>
              Short Code {sortColumn === 'shortCode' && (
                sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
              )}
            </TableCell>
            <TableCell onClick={() => onSort('longUrl')} sx={{ cursor: 'pointer', width: '60%' }}>
              Long URL {sortColumn === 'longUrl' && (
                sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
              )}
            </TableCell>
            <TableCell align="right" sx={{ width: '25%' }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {mappings.map((mapping) => (
            <TableRow key={mapping.shortCode}>
              <TableCell component="th" scope="row">
                {mapping.shortCode}
              </TableCell>
              <TableCell>
                <a href={mapping.longUrl} target="_blank" rel="noopener noreferrer">
                  {mapping.longUrl}
                </a>
              </TableCell>
              <TableCell align="right">
                <IconButton onClick={() => onShowQrCode(mapping.shortCode)} color="primary" aria-label="show QR code">
                  <QrCode />
                </IconButton>
                <IconButton onClick={() => onEdit(mapping)} color="primary" aria-label="edit">
                  <Edit />
                </IconButton>
                <IconButton onClick={() => onDelete(mapping.shortCode)} color="error" aria-label="delete">
                  <Delete />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={totalMappings}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
      />
    </TableContainer>
  );
};

import { Dialog, DialogTitle, DialogContent, DialogActions, Grid } from '@mui/material';

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
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{isEditMode ? 'Edit Short URL' : 'Create New Short URL'}</DialogTitle>
      <DialogContent dividers sx={{ p: 3, boxShadow: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <fieldset disabled={isSubmitting}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="longUrl"
              label="Long URL"
              name="longUrl"
              autoFocus
              value={formData.longUrl}
              onChange={handleChange}
              placeholder="https://example.com/my-very-long-url"
              type="url"
            />
            <TextField
              margin="normal"
              fullWidth
              id="customShortCode"
              label={isEditMode ? 'Short Code' : 'Custom Short Code (Optional)'}
              name="customShortCode"
              value={isEditMode ? initialData.shortCode : formData.customShortCode}
              onChange={handleChange}
              placeholder={isEditMode ? '' : 'my-custom-code (or leave blank)'}
              disabled={isEditMode}
            />
            <Typography variant="h6" sx={{ mt: 3, mb: 2, color: 'text.secondary' }}>UTM Parameters (Optional)</Typography>
            <Grid container spacing={2}>
              <Grid>
                <TextField
                  fullWidth
                  id="utm_source"
                  label="UTM Source"
                  name="utm_source"
                  value={formData.utm_source}
                  onChange={handleChange}
                  placeholder="e.g., google"
                />
              </Grid>
              <Grid>
                <TextField
                  fullWidth
                  id="utm_medium"
                  label="UTM Medium"
                  name="utm_medium"
                  value={formData.utm_medium}
                  onChange={handleChange}
                  placeholder="e.g., cpc"
                />
              </Grid>
              <Grid>
                <TextField
                  fullWidth
                  id="utm_campaign"
                  label="UTM Campaign"
                  name="utm_campaign"
                  value={formData.utm_campaign}
                  onChange={handleChange}
                  placeholder="e.g., summer_sale"
                />
              </Grid>
            </Grid>
          </fieldset>
        </form>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>
          {isSubmitting ? <CircularProgress size={24} /> : (isEditMode ? 'Save Changes' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const QrCodeModal = ({ url, onClose }) => (
  <Dialog open onClose={onClose}>
    <DialogTitle>QR Code</DialogTitle>
    <DialogContent sx={{ textAlign: 'center' }}>
      <QRCodeCanvas value={url} size={256} />
      <Typography variant="body2" sx={{ mt: 2, fontFamily: 'monospace' }}>{url}</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
);

const Spinner = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}>
    <CircularProgress />
  </Box>
);

export default App;
