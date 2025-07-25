import { state } from '../state/index.js';
import { showToast, copyToClipboard, sendLoraToWorkflow } from '../utils/uiHelpers.js';
import { updateCardsForBulkMode } from '../components/shared/ModelCard.js';
import { modalManager } from './ModalManager.js';

export class BulkManager {
    constructor() {
        this.bulkBtn = document.getElementById('bulkOperationsBtn');
        this.bulkPanel = document.getElementById('bulkOperationsPanel');
        this.isStripVisible = false; // Track strip visibility state
        
        // Initialize selected loras set in state if not already there
        if (!state.selectedLoras) {
            state.selectedLoras = new Set();
        }
        
        // Cache for lora metadata to handle non-visible selected loras
        if (!state.loraMetadataCache) {
            state.loraMetadataCache = new Map();
        }

        this.stripMaxThumbnails = 50; // Maximum thumbnails to show in strip
    }

    initialize() {
        // Add event listeners if needed
        // (Already handled via onclick attributes in HTML, but could be moved here)
        
        // Add event listeners for the selected count to toggle thumbnail strip
        const selectedCount = document.getElementById('selectedCount');
        if (selectedCount) {
            selectedCount.addEventListener('click', () => this.toggleThumbnailStrip());
        }

        // Add global keyboard event listener for Ctrl+A
        document.addEventListener('keydown', (e) => {
            // First check if any modal is currently open - if so, don't handle Ctrl+A
            if (modalManager.isAnyModalOpen()) {
                return; // Exit early - let the browser handle Ctrl+A within the modal
            }

            // Check if search input is currently focused - if so, don't handle Ctrl+A
            const searchInput = document.getElementById('searchInput');
            if (searchInput && document.activeElement === searchInput) {
                return; // Exit early - let the browser handle Ctrl+A within the search input
            }

            // Check if it's Ctrl+A (or Cmd+A on Mac)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {

                // Prevent default browser "Select All" behavior
                e.preventDefault();
                
                // If not in bulk mode, enable it first
                if (!state.bulkMode) {
                    this.toggleBulkMode();
                    // Small delay to ensure DOM is updated
                    setTimeout(() => this.selectAllVisibleLoras(), 50);
                } else {
                    this.selectAllVisibleLoras();
                }
            } else if (e.key === 'Escape' && state.bulkMode) {
                // If in bulk mode, exit it on Escape
                this.toggleBulkMode();
            } else if (e.key.toLowerCase() === 'b') {
                // If 'b' is pressed, toggle bulk mode
                this.toggleBulkMode();
            }
        });
    }

    toggleBulkMode() {
        // Toggle the state
        state.bulkMode = !state.bulkMode;
        
        // Update UI
        this.bulkBtn.classList.toggle('active', state.bulkMode);
        
        // Important: Remove the hidden class when entering bulk mode
        if (state.bulkMode) {
            this.bulkPanel.classList.remove('hidden');
            // Use setTimeout to ensure the DOM updates before adding visible class
            // This helps with the transition animation
            setTimeout(() => {
                this.bulkPanel.classList.add('visible');
            }, 10);
        } else {
            this.bulkPanel.classList.remove('visible');
            // Add hidden class back after transition completes
            setTimeout(() => {
                this.bulkPanel.classList.add('hidden');
            }, 400); // Match this with the transition duration in CSS
            
            // Hide thumbnail strip if it's visible
            this.hideThumbnailStrip();
        }
        
        // First update all cards' visual state before clearing selection
        updateCardsForBulkMode(state.bulkMode);
        
        // Clear selection if exiting bulk mode - do this after updating cards
        if (!state.bulkMode) {
            this.clearSelection();
            
            // TODO: fix this, no DOM manipulation should be done here
            // Force a lightweight refresh of the cards to ensure proper display
            // This is less disruptive than a full resetAndReload()
            document.querySelectorAll('.lora-card').forEach(card => {
                // Re-apply normal display mode to all card actions
                const actions = card.querySelectorAll('.card-actions, .card-button');
                actions.forEach(action => action.style.display = 'flex');
            });
        }
    }

    clearSelection() {
        document.querySelectorAll('.lora-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        state.selectedLoras.clear();
        this.updateSelectedCount();
        
        // Hide thumbnail strip if it's visible
        this.hideThumbnailStrip();
    }

    updateSelectedCount() {
        const countElement = document.getElementById('selectedCount');
        
        if (countElement) {
            // Set text content without the icon
            countElement.textContent = `${state.selectedLoras.size} selected `;
            
            // Update caret icon if it exists
            const existingCaret = countElement.querySelector('.dropdown-caret');
            if (existingCaret) {
                existingCaret.className = `fas fa-caret-${this.isStripVisible ? 'down' : 'up'} dropdown-caret`;
                existingCaret.style.visibility = state.selectedLoras.size > 0 ? 'visible' : 'hidden';
            } else {
                // Create new caret icon if it doesn't exist
                const caretIcon = document.createElement('i');
                caretIcon.className = `fas fa-caret-${this.isStripVisible ? 'down' : 'up'} dropdown-caret`;
                caretIcon.style.visibility = state.selectedLoras.size > 0 ? 'visible' : 'hidden';
                countElement.appendChild(caretIcon);
            }
        }
    }

    toggleCardSelection(card) {
        const filepath = card.dataset.filepath;
        
        if (card.classList.contains('selected')) {
            card.classList.remove('selected');
            state.selectedLoras.delete(filepath);
        } else {
            card.classList.add('selected');
            state.selectedLoras.add(filepath);
            
            // Cache the metadata for this lora
            state.loraMetadataCache.set(filepath, {
                fileName: card.dataset.file_name,
                usageTips: card.dataset.usage_tips,
                previewUrl: this.getCardPreviewUrl(card),
                isVideo: this.isCardPreviewVideo(card),
                modelName: card.dataset.name
            });
        }
        
        this.updateSelectedCount();
        
        // Update thumbnail strip if it's visible
        if (this.isStripVisible) {
            this.updateThumbnailStrip();
        }
    }
    
    // Helper method to get preview URL from a card
    getCardPreviewUrl(card) {
        const img = card.querySelector('img');
        const video = card.querySelector('video source');
        return img ? img.src : (video ? video.src : '/loras_static/images/no-preview.png');
    }
    
    // Helper method to check if preview is a video
    isCardPreviewVideo(card) {
        return card.querySelector('video') !== null;
    }

    // Apply selection state to cards after they are refreshed
    applySelectionState() {
        if (!state.bulkMode) return;
        
        document.querySelectorAll('.lora-card').forEach(card => {
            const filepath = card.dataset.filepath;
            if (state.selectedLoras.has(filepath)) {
                card.classList.add('selected');
                
                // Update the cache with latest data
                state.loraMetadataCache.set(filepath, {
                    fileName: card.dataset.file_name,
                    usageTips: card.dataset.usage_tips,
                    previewUrl: this.getCardPreviewUrl(card),
                    isVideo: this.isCardPreviewVideo(card),
                    modelName: card.dataset.name
                });
            } else {
                card.classList.remove('selected');
            }
        });
        
        this.updateSelectedCount();
    }

    async copyAllLorasSyntax() {
        if (state.selectedLoras.size === 0) {
            showToast('No LoRAs selected', 'warning');
            return;
        }
        
        const loraSyntaxes = [];
        const missingLoras = [];
        
        // Process all selected loras using our metadata cache
        for (const filepath of state.selectedLoras) {
            const metadata = state.loraMetadataCache.get(filepath);
            
            if (metadata) {
                const usageTips = JSON.parse(metadata.usageTips || '{}');
                const strength = usageTips.strength || 1;
                loraSyntaxes.push(`<lora:${metadata.fileName}:${strength}>`);
            } else {
                // If we don't have metadata, this is an error case
                missingLoras.push(filepath);
            }
        }
        
        // Handle any loras with missing metadata
        if (missingLoras.length > 0) {
            console.warn('Missing metadata for some selected loras:', missingLoras);
            showToast(`Missing data for ${missingLoras.length} LoRAs`, 'warning');
        }
        
        if (loraSyntaxes.length === 0) {
            showToast('No valid LoRAs to copy', 'error');
            return;
        }
        
        await copyToClipboard(loraSyntaxes.join(', '), `Copied ${loraSyntaxes.length} LoRA syntaxes to clipboard`);
    }
    
    // Add method to send all selected loras to workflow
    async sendAllLorasToWorkflow() {
        if (state.selectedLoras.size === 0) {
            showToast('No LoRAs selected', 'warning');
            return;
        }
        
        const loraSyntaxes = [];
        const missingLoras = [];
        
        // Process all selected loras using our metadata cache
        for (const filepath of state.selectedLoras) {
            const metadata = state.loraMetadataCache.get(filepath);
            
            if (metadata) {
                const usageTips = JSON.parse(metadata.usageTips || '{}');
                const strength = usageTips.strength || 1;
                loraSyntaxes.push(`<lora:${metadata.fileName}:${strength}>`);
            } else {
                // If we don't have metadata, this is an error case
                missingLoras.push(filepath);
            }
        }
        
        // Handle any loras with missing metadata
        if (missingLoras.length > 0) {
            console.warn('Missing metadata for some selected loras:', missingLoras);
            showToast(`Missing data for ${missingLoras.length} LoRAs`, 'warning');
        }
        
        if (loraSyntaxes.length === 0) {
            showToast('No valid LoRAs to send', 'error');
            return;
        }
        
        // Send the loras to the workflow
        await sendLoraToWorkflow(loraSyntaxes.join(', '), false, 'lora');
    }
    
    // Show the bulk delete confirmation modal
    showBulkDeleteModal() {
        if (state.selectedLoras.size === 0) {
            showToast('No LoRAs selected', 'warning');
            return;
        }
        
        // Update the count in the modal
        const countElement = document.getElementById('bulkDeleteCount');
        if (countElement) {
            countElement.textContent = state.selectedLoras.size;
        }
        
        // Show the modal
        modalManager.showModal('bulkDeleteModal');
    }
    
    // Confirm bulk delete action
    async confirmBulkDelete() {
        if (state.selectedLoras.size === 0) {
            showToast('No LoRAs selected', 'warning');
            modalManager.closeModal('bulkDeleteModal');
            return;
        }
        
        // Close the modal first before showing loading indicator
        modalManager.closeModal('bulkDeleteModal');
        
        try {
            // Show loading indicator
            state.loadingManager.showSimpleLoading('Deleting models...');
            
            // Gather all file paths for deletion
            const filePaths = Array.from(state.selectedLoras);
            
            // Call the backend API
            const response = await fetch('/api/loras/bulk-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_paths: filePaths
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast(`Successfully deleted ${result.deleted_count} models`, 'success');
                
                // If virtual scroller exists, update the UI without page reload
                if (state.virtualScroller) {
                    // Remove each deleted item from the virtual scroller
                    filePaths.forEach(path => {
                        state.virtualScroller.removeItemByFilePath(path);
                    });
                    
                    // Clear the selection
                    this.clearSelection();
                } else {
                    // Clear the selection
                    this.clearSelection();
                    
                    // Fall back to page reload for non-virtual scroll mode
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                }

                if (window.modelDuplicatesManager) {
                    // Update duplicates badge after refresh
                    window.modelDuplicatesManager.updateDuplicatesBadgeAfterRefresh();
                }
            } else {
                showToast(`Error: ${result.error || 'Failed to delete models'}`, 'error');
            }
        } catch (error) {
            console.error('Error during bulk delete:', error);
            showToast('Failed to delete models', 'error');
        } finally {
            // Hide loading indicator
            state.loadingManager.hide();
        }
    }

    // Create and show the thumbnail strip of selected LoRAs
    toggleThumbnailStrip() {
        // If no items are selected, do nothing
        if (state.selectedLoras.size === 0) return;
        
        const existing = document.querySelector('.selected-thumbnails-strip');
        if (existing) {
            this.hideThumbnailStrip();
        } else {
            this.showThumbnailStrip();
        }
    }
    
    showThumbnailStrip() {
        // Create the thumbnail strip container
        const strip = document.createElement('div');
        strip.className = 'selected-thumbnails-strip';
        
        // Create a container for the thumbnails (for scrolling)
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'thumbnails-container';
        strip.appendChild(thumbnailContainer);
        
        // Position the strip above the bulk operations panel
        this.bulkPanel.parentNode.insertBefore(strip, this.bulkPanel);
        
        // Populate the thumbnails
        this.updateThumbnailStrip();
        
        // Update strip visibility state and caret direction
        this.isStripVisible = true;
        this.updateSelectedCount(); // Update caret
        
        // Add animation class after a short delay to trigger transition
        setTimeout(() => strip.classList.add('visible'), 10);
    }
    
    hideThumbnailStrip() {
        const strip = document.querySelector('.selected-thumbnails-strip');
        if (strip && this.isStripVisible) {  // Only hide if actually visible
            strip.classList.remove('visible');
            
            // Update strip visibility state
            this.isStripVisible = false;
            
            // Update caret without triggering another hide
            const countElement = document.getElementById('selectedCount');
            if (countElement) {
                const caret = countElement.querySelector('.dropdown-caret');
                if (caret) {
                    caret.className = 'fas fa-caret-up dropdown-caret';
                }
            }
            
            // Wait for animation to complete before removing
            setTimeout(() => {
                if (strip.parentNode) {
                    strip.parentNode.removeChild(strip);
                }
            }, 300);
        }
    }
    
    updateThumbnailStrip() {
        const container = document.querySelector('.thumbnails-container');
        if (!container) return;
        
        // Clear existing thumbnails
        container.innerHTML = '';
        
        // Get all selected loras
        const selectedLoras = Array.from(state.selectedLoras);
        
        // Create counter if we have more thumbnails than we'll show
        if (selectedLoras.length > this.stripMaxThumbnails) {
            const counter = document.createElement('div');
            counter.className = 'strip-counter';
            counter.textContent = `Showing ${this.stripMaxThumbnails} of ${selectedLoras.length} selected`;
            container.appendChild(counter);
        }
        
        // Limit the number of thumbnails to display
        const thumbnailsToShow = selectedLoras.slice(0, this.stripMaxThumbnails);
        
        // Add a thumbnail for each selected LoRA (limited to max)
        thumbnailsToShow.forEach(filepath => {
            const metadata = state.loraMetadataCache.get(filepath);
            if (!metadata) return;
            
            const thumbnail = document.createElement('div');
            thumbnail.className = 'selected-thumbnail';
            thumbnail.dataset.filepath = filepath;
            
            // Create the visual element (image or video)
            if (metadata.isVideo) {
                thumbnail.innerHTML = `
                    <video autoplay loop muted playsinline>
                        <source src="${metadata.previewUrl}" type="video/mp4">
                    </video>
                    <span class="thumbnail-name" title="${metadata.modelName}">${metadata.modelName}</span>
                    <button class="thumbnail-remove"><i class="fas fa-times"></i></button>
                `;
            } else {
                thumbnail.innerHTML = `
                    <img src="${metadata.previewUrl}" alt="${metadata.modelName}">
                    <span class="thumbnail-name" title="${metadata.modelName}">${metadata.modelName}</span>
                    <button class="thumbnail-remove"><i class="fas fa-times"></i></button>
                `;
            }
            
            // Add click handler for deselection
            thumbnail.addEventListener('click', (e) => {
                if (!e.target.closest('.thumbnail-remove')) {
                    this.deselectItem(filepath);
                }
            });
            
            // Add click handler for the remove button
            thumbnail.querySelector('.thumbnail-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deselectItem(filepath);
            });
            
            container.appendChild(thumbnail);
        });
    }
    
    deselectItem(filepath) {
        // Find and deselect the corresponding card if it's in the DOM
        const card = document.querySelector(`.lora-card[data-filepath="${filepath}"]`);
        if (card) {
            card.classList.remove('selected');
        }
        
        // Remove from the selection set
        state.selectedLoras.delete(filepath);
        
        // Update UI
        this.updateSelectedCount();
        this.updateThumbnailStrip();
        
        // Hide the strip if no more selections
        if (state.selectedLoras.size === 0) {
            this.hideThumbnailStrip();
        }
    }

    // Add method to select all visible loras
    selectAllVisibleLoras() {
        // Only select loras already in the VirtualScroller's data model
        if (!state.virtualScroller || !state.virtualScroller.items) {
            showToast('Unable to select all items', 'error');
            return;
        }
        
        const oldCount = state.selectedLoras.size;
        
        // Add all loaded loras to the selection set
        state.virtualScroller.items.forEach(item => {
            if (item && item.file_path) {
                state.selectedLoras.add(item.file_path);
                
                // Add to metadata cache if not already there
                if (!state.loraMetadataCache.has(item.file_path)) {
                    state.loraMetadataCache.set(item.file_path, {
                        fileName: item.file_name,
                        usageTips: item.usage_tips || '{}',
                        previewUrl: item.preview_url || '/loras_static/images/no-preview.png',
                        isVideo: item.is_video || false,
                        modelName: item.name || item.file_name
                    });
                }
            }
        });
        
        // Update visual state
        this.applySelectionState();
        
        // Show success message
        const newlySelected = state.selectedLoras.size - oldCount;
        showToast(`Selected ${newlySelected} additional LoRAs`, 'success');
        
        // Update thumbnail strip if visible
        if (this.isStripVisible) {
            this.updateThumbnailStrip();
        }
    }
}

// Create a singleton instance
export const bulkManager = new BulkManager();
