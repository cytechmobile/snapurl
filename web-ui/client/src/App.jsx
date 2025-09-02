import { useState, useEffect, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
	Container,
	Box,
	Typography,
	Paper,
	TextField,
	Button,
	IconButton,
	CircularProgress,
	Alert,
	TablePagination,
	Snackbar,
	Chip, // Import Chip
} from '@mui/material';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { AppBar, Toolbar as MuiToolbar } from '@mui/material'; // Renamed Toolbar to MuiToolbar to avoid conflict
import { Add, Refresh, QrCode, Edit, Delete, ArrowUpward, ArrowDownward, ContentCopy } from '@mui/icons-material';
import { Dialog, DialogTitle, DialogContent, DialogActions, Grid } from '@mui/material';
import { useMappings } from './hooks/useMappings';
import LinkModal from './LinkModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL || 'http://localhost:3001';
const WORKER_URL_FALLBACK = import.meta.env.VITE_WORKER_URL || 'https://your-worker.workers.dev';

function App() {
	const { mappings, isLoading, error, fetchMappings, createMapping, updateMapping, deleteMapping } = useMappings();
	const [searchTerm, setSearchTerm] = useState('');
	const [clickedTagFilter, setClickedTagFilter] = useState(''); // New state for clicked tag filter
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [sortColumn, setSortColumn] = useState('lastUpdated');
	const [sortDirection, setSortDirection] = useState('desc');
	const [editingMapping, setEditingMapping] = useState(null); // Use this for both create and edit
	const [qrCodeValue, setQrCodeValue] = useState(null);
	const [shortUrlHost, setShortUrlHost] = useState(() => localStorage.getItem('shortUrlHost') || WORKER_URL_FALLBACK);
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	const [snackbarMessage, setSnackbarMessage] = useState('');

	useEffect(() => {
		localStorage.setItem('shortUrlHost', shortUrlHost);
	}, [shortUrlHost]);

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
		const { success, error } = await createMapping(formData);
		if (success) {
			setSnackbarMessage('Short URL created successfully!');
			setSnackbarOpen(true);
		} else {
			setSnackbarMessage(`Error creating short URL: ${error}`);
			setSnackbarOpen(true);
		}
		handleModalClose();
	};

	const handleUpdate = async (formData) => {
		const { success, error } = await updateMapping(formData);
		if (success) {
			setSnackbarMessage('Short URL updated successfully!');
			setSnackbarOpen(true);
			fetchMappings(true);
		} else {
			setSnackbarMessage(`Error updating short URL: ${error}`);
			setSnackbarOpen(true);
		}
		handleModalClose();
	};

	const handleDelete = async (shortCode) => {
		if (window.confirm(`Are you sure you want to delete the short URL "${shortCode}"?`)) {
			const { success, error } = await deleteMapping(shortCode);
			if (success) {
				setSnackbarMessage('Short URL deleted successfully!');
				setSnackbarOpen(true);
			} else {
				setSnackbarMessage(`Error deleting short URL: ${error}`);
				setSnackbarOpen(true);
			}
		}
	};

	const handleCopyToClipboard = (text) => {
		navigator.clipboard.writeText(text).then(
			() => {
				setSnackbarMessage('Copied to clipboard!');
				setSnackbarOpen(true);
			},
			(err) => {
				setSnackbarMessage('Failed to copy!');
				setSnackbarOpen(true);
				console.error('Could not copy text: ', err);
			}
		);
	};

	const handleSnackbarClose = (event, reason) => {
		if (reason === 'clickaway') {
			return;
		}
		setSnackbarOpen(false);
	};

	const handleTagChipClick = (tag) => {
		setSearchTerm(tag); // Set the search term to the clicked tag
		setClickedTagFilter(tag); // Store the clicked tag for filtering
		setPage(0); // Reset pagination
	};

	const filteredAndSortedMappings = useMemo(() => {
		const currentFilterTerm = clickedTagFilter || searchTerm;
		const lowerCaseFilterTerm = currentFilterTerm.toLowerCase();

		const filtered = mappings.filter(
			(m) =>
				(m.shortCode.toLowerCase().includes(lowerCaseFilterTerm) ||
				(m.longUrl && m.longUrl.toLowerCase().includes(lowerCaseFilterTerm)) ||
				(m.tags && m.tags.some(tag => tag.toLowerCase().includes(lowerCaseFilterTerm))))
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
	}, [mappings, searchTerm, clickedTagFilter, sortColumn, sortDirection]);

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

	const handleLogout = () => {
		const authDomain = window.AUTH_DOMAIN;
		if (authDomain && authDomain !== '__AUTH_DOMAIN__') {
			const logoutUrl = `https://${authDomain}/cdn-cgi/access/logout`;
			window.location.href = logoutUrl;
		} else {
			console.error('Auth domain is not configured.');
		}
	};

	return (
		<Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
			<Header onLogout={handleLogout} />
			<Box component="main" sx={{ flexGrow: 1, p: 4 }}>
				<SettingsBar host={shortUrlHost} onHostChange={(e) => setShortUrlHost(e.target.value)} />
				<Toolbar
					onRefresh={() => fetchMappings(true)}
					onShowCreateModal={handleShowCreateModal}
					searchTerm={searchTerm}
					onSearchTermChange={(e) => {
						setSearchTerm(e.target.value);
						setClickedTagFilter(''); // Clear clickedTagFilter when user types
						setPage(0);
					}}
				/>
				{error && (
					<Alert severity="error" sx={{ mt: 3, p: 2, boxShadow: 3 }}>
						<strong>Error:</strong> {error}
					</Alert>
				)}
				{isLoading && <Spinner />}
				{!isLoading && !error && (
					<MappingTable
						mappings={paginatedMappings}
						onDelete={handleDelete}
						onEdit={handleShowEditModal}
						onShowQrCode={(shortCode) => setQrCodeValue(`${shortUrlHost.replace(/\/$/, '')}/${shortCode}`)}
						onCopyToClipboard={(shortCode) => handleCopyToClipboard(`${shortUrlHost.replace(/\/$/, '')}/${shortCode}`)}
						page={page}
						rowsPerPage={rowsPerPage}
						totalMappings={filteredAndSortedMappings.length}
						onPageChange={handleChangePage}
						onRowsPerPageChange={handleChangeRowsPerPage}
						sortColumn={sortColumn}
						sortDirection={sortDirection}
						onSort={handleSort}
						onTagChipClick={handleTagChipClick}
					/>
				)}
			</Box>
			{editingMapping && (
				<LinkModal
					initialData={editingMapping}
					onClose={handleModalClose}
					onSave={editingMapping.shortCode ? handleUpdate : handleCreate}
					existingShortCodes={mappings.map((m) => m.shortCode)}
				/>
			)}
			{qrCodeValue && <QrCodeModal url={qrCodeValue} onClose={() => setQrCodeValue(null)} />}
			<Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={handleSnackbarClose} message={snackbarMessage} />
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

const Header = ({ onLogout }) => (
	<AppBar position="static" sx={{ mb: 3, boxShadow: 3 }}>
		<MuiToolbar>
			<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
				🔗 SnapURL
			</Typography>
			<Button color="inherit" onClick={onLogout}>
				Logout
			</Button>
		</MuiToolbar>
	</AppBar>
);

const Toolbar = ({ onRefresh, onShowCreateModal, searchTerm, onSearchTermChange }) => (
	<Box
		sx={{
			display: 'flex',
			justifyContent: 'space-between',
			alignItems: 'center',
			mb: 3,
			p: 2,
			border: '1px solid #e0e0e0',
			borderRadius: '4px',
		}}
	>
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

const MappingTable = ({
	mappings,
	onDelete,
	onEdit,
	onShowQrCode,
	onCopyToClipboard,
	sortColumn,
	sortDirection,
	onSort,
	page,
	rowsPerPage,
	totalMappings,
	onPageChange,
	onRowsPerPageChange,
	onTagChipClick,
}) => {
	if (mappings.length === 0) {
		return (
			<Typography variant="body1" sx={{ mt: 3, textAlign: 'center' }}>
				No URL mappings found.
			</Typography>
		);
	}
	return (
		<TableContainer component={Paper} sx={{ mt: 3, p: 2, boxShadow: 3 }}>
			<Table sx={{ minWidth: 650 }} aria-label="simple table">
				<TableHead>
					<TableRow>
						<TableCell onClick={() => onSort('shortCode')} sx={{ cursor: 'pointer', width: '10%' }}>
							Short Code{' '}
							{sortColumn === 'shortCode' &&
								(sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
						</TableCell>
						<TableCell onClick={() => onSort('longUrl')} sx={{ cursor: 'pointer', width: '40%' }}>
							Long URL{' '}
							{sortColumn === 'longUrl' &&
								(sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
						</TableCell>
						<TableCell onClick={() => onSort('tags')} sx={{ cursor: 'pointer', width: '10%' }}>
							Tags{' '}
							{sortColumn === 'tags' &&
								(sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
						</TableCell>
                        <TableCell onClick={() => onSort('lastUpdated')} sx={{ cursor: 'pointer', width: '15%' }}>
							Last Updated{' '}
							{sortColumn === 'lastUpdated' &&
								(sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
						</TableCell>
						<TableCell align="right" sx={{ width: '15%' }}>
							Actions
						</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{mappings.map((mapping) => (
						<TableRow key={mapping.shortCode}>
							<TableCell component="th" scope="row" sx={{ py: 1.5, whiteSpace: 'nowrap' }}>
								{mapping.shortCode}
							</TableCell>
							<TableCell sx={{ py: 1.5, wordBreak: 'break-all' }}>
								<a href={mapping.longUrl} target="_blank" rel="noopener noreferrer">
									{mapping.longUrl}
								</a>
							</TableCell>
							<TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>
								<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
									{mapping.tags && mapping.tags.map((tag) => <Chip key={tag} label={tag} size="small" onClick={() => onTagChipClick(tag)} sx={{ cursor: 'pointer' }} />)}
								</Box>
							</TableCell>
                            <TableCell sx={{ py: 1.5, whiteSpace: 'nowrap' }}>
                                {mapping.lastUpdated ? new Date(mapping.lastUpdated).toLocaleString() : 'N/A'}
                            </TableCell>
							<TableCell align="right" sx={{ py: 1.5, whiteSpace: 'nowrap' }}>
								<IconButton onClick={() => onCopyToClipboard(mapping.shortCode)} color="primary" aria-label="copy short url">
									<ContentCopy />
								</IconButton>
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



const QrCodeModal = ({ url, onClose }) => (
	<Dialog open onClose={onClose}>
		<DialogTitle>QR Code</DialogTitle>
		<DialogContent sx={{ textAlign: 'center' }}>
			<QRCodeCanvas value={url} size={256} />
			<Typography variant="body2" sx={{ mt: 2, fontFamily: 'monospace' }}>
				{url}
			</Typography>
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
