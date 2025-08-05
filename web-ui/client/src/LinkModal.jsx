import { useState, useEffect, useMemo } from 'react';
import { nanoid } from 'nanoid';
import {
	TextField,
	Button,
	CircularProgress,
	Alert,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Grid,
	Typography,
	Chip, // Import Chip
	Box, // Import Box for flex container
} from '@mui/material';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const LinkModal = ({ initialData = {}, onClose, onSave, existingShortCodes, testUrlValidationStatus }) => {
	const isEditMode = !!initialData.shortCode;

	const [formData, setFormData] = useState({
		longUrl: initialData.longUrl || '',
		customShortCode: initialData.shortCode || '',
		utm_source: initialData.utm_source || '',
		utm_medium: initialData.utm_medium || '',
		utm_campaign: initialData.utm_campaign || '',
		tags: initialData.tags || [], // Tags are now an array
		...(isEditMode && { shortCode: initialData.shortCode }), // Include shortCode only in edit mode
	});
	const [tagInput, setTagInput] = useState(''); // State for the new tag input field
	const [modalError, setModalError] = useState('');
	const [longUrlInputError, setLongUrlInputError] = useState('');
	const [customShortCodeInputError, setCustomShortCodeInputError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [urlValidationStatus, setUrlValidationStatus] = useState(testUrlValidationStatus || null); // null, 'valid', 'invalid', 'checking'
	const [urlValidationMessage, setUrlValidationMessage] = useState('');

	// Debounce utility
	const debounce = (func, delay) => {
		let timeout;
		return function (...args) {
			const context = this;
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(context, args), delay);
		};
	};

	const validateLongUrl = useMemo(
		() =>
			debounce(async (url) => {
				if (!url) {
					setUrlValidationStatus(null);
					setUrlValidationMessage('');
					return;
				}

				setUrlValidationStatus('checking');
				setUrlValidationMessage('Checking URL...');

				try {
					const response = await fetch(`${API_BASE_URL}/validate-url?url=${encodeURIComponent(url)}`);
					const result = await response.json();

					if (result.isValid) {
						setUrlValidationStatus('valid');
						setUrlValidationMessage('URL is reachable.');
					} else {
						setUrlValidationStatus('invalid');
						setUrlValidationMessage(result.message || 'URL is not reachable.');
					}
				} catch (err) {
					setUrlValidationStatus('invalid');
					setUrlValidationMessage('Error checking URL. Please try again.');
					console.error('URL validation API error:', err);
				}
			}, 500),
		[]
	);

	useEffect(() => {
		validateLongUrl(formData.longUrl);
	}, [formData.longUrl, validateLongUrl]);

	const handleChange = (e) => {
		const { id, value } = e.target;
		setFormData((prev) => ({ ...prev, [id]: value }));
		// Clear specific input errors when user types
		if (id === 'longUrl') {
			setLongUrlInputError('');
		} else if (id === 'customShortCode') {
			setCustomShortCodeInputError('');
		}
		setModalError(''); // Clear general modal error on any change
	};

	const handleAddTag = (event) => {
		if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
			event.preventDefault(); // Prevent form submission
			const newTag = tagInput.trim();
			if (newTag && !formData.tags.includes(newTag)) {
				setFormData((prev) => ({ ...prev, tags: [...prev.tags, newTag] }));
				setTagInput('');
			}
		}
	};

	const handleDeleteTag = (tagToDelete) => {
		setFormData((prev) => ({
			...prev,
			tags: prev.tags.filter((tag) => tag !== tagToDelete),
		}));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setModalError('');
		setLongUrlInputError('');
		setCustomShortCodeInputError('');

		let hasError = false;

		// --- Client-side validation (basic format check) ---
		if (!formData.longUrl) {
			setLongUrlInputError('Long URL cannot be empty.');
			hasError = true;
		} else {
			const urlRegex =
				/^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
			if (!urlRegex.test(formData.longUrl)) {
				setLongUrlInputError('Please enter a valid URL (e.g., https://example.com or http://example.com).');
				hasError = true;
			}
		}

		if (formData.customShortCode) {
			if (!/^[a-zA-Z0-9_-]+$/.test(formData.customShortCode)) {
				setCustomShortCodeInputError('Short code can only contain letters, numbers, hyphens, and underscores.');
				hasError = true;
			} else if (!isEditMode && existingShortCodes.includes(formData.customShortCode)) {
				setCustomShortCodeInputError('This short code already exists.');
				hasError = true;
			}
		}

		// --- Server-side URL reachability check ---
		if (urlValidationStatus !== 'valid') {
			setModalError(urlValidationMessage || 'Please ensure the long URL is valid and reachable.');
			hasError = true;
		}

		if (hasError) {
			return;
		}

		setIsSubmitting(true);
		try {
			await onSave(formData);
			// No need to call onClose here, as the parent component will handle it.
		} catch (err) {
			setModalError(err.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open onClose={onClose} fullWidth maxWidth="md">
			<DialogTitle>{isEditMode ? 'Edit Short URL' : 'Create New Short URL'}</DialogTitle>
			<DialogContent dividers sx={{ p: 3, boxShadow: 1 }}>
				{modalError && (
					<Alert severity="error" sx={{ mb: 2 }}>
						{modalError}
					</Alert>
				)}
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
							error={urlValidationStatus === 'invalid' || !!longUrlInputError}
							helperText={urlValidationMessage || longUrlInputError}
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
							error={!!customShortCodeInputError}
							helperText={customShortCodeInputError}
						/>
						<Typography variant="h6" sx={{ mt: 3, mb: 2, color: 'text.secondary' }}>
							UTM Parameters (Optional)
						</Typography>
						<Grid container spacing={2}>
							<Grid item xs={12} sm={4}>
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
							<Grid item xs={12} sm={4}>
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
							<Grid item xs={12} sm={4}>
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
						<Typography variant="h6" sx={{ mt: 3, mb: 2, color: 'text.secondary' }}>
							Tags
						</Typography>
						<TextField
							fullWidth
							id="tagInput"
							label="Add Tags"
							name="tagInput"
							value={tagInput}
							onChange={(e) => setTagInput(e.target.value)}
							onKeyDown={handleAddTag}
							placeholder="Type tag and press Enter or comma"
							margin="normal"
						/>
						<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
							{formData.tags.map((tag) => (
								<Chip key={tag} label={tag} onDelete={() => handleDeleteTag(tag)} />
							))}
						</Box>
					</fieldset>
				</form>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose} disabled={isSubmitting}>
					Cancel
				</Button>
				<Button onClick={handleSubmit} variant="contained" disabled={isSubmitting || urlValidationStatus !== 'valid'}>
					{isSubmitting ? <CircularProgress size={24} /> : isEditMode ? 'Save Changes' : 'Create'}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default LinkModal;
