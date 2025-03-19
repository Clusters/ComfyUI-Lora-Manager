import { appCore, state } from './core.js';
import { showLoraModal, toggleShowcase, scrollToTop } from './components/LoraModal.js';
import { loadMoreLoras, fetchCivitai, deleteModel, replacePreview, resetAndReload, refreshLoras } from './api/loraApi.js';
import { 
    lazyLoadImages, 
    restoreFolderFilter, 
    toggleFolder,
    copyTriggerWord,
    openCivitai,
    toggleFolderTags,
    initFolderTagsVisibility,
    updatePanelPositions
} from './utils/uiHelpers.js';
import { initializeInfiniteScroll } from './utils/infiniteScroll.js';
import { showDeleteModal, confirmDelete, closeDeleteModal } from './utils/modalUtils.js';
import { DownloadManager } from './managers/DownloadManager.js';
import { toggleApiKeyVisibility } from './managers/SettingsManager.js';
import { LoraContextMenu } from './components/ContextMenu.js';
import { moveManager } from './managers/MoveManager.js';
import { createLoraCard, updateCardsForBulkMode } from './components/LoraCard.js';
import { bulkManager } from './managers/BulkManager.js';

// Initialize the LoRA page
class LoraPageManager {
    constructor() {
        // Add bulk mode to state
        state.bulkMode = false;
        state.selectedLoras = new Set();
        
        // Initialize managers
        this.downloadManager = new DownloadManager();
        
        // Expose necessary functions to the page
        this._exposeGlobalFunctions();
    }
    
    _exposeGlobalFunctions() {
        // Only expose what's needed for the page
        window.loadMoreLoras = loadMoreLoras;
        window.fetchCivitai = fetchCivitai;
        window.deleteModel = deleteModel;
        window.replacePreview = replacePreview;
        window.toggleFolder = toggleFolder;
        window.copyTriggerWord = copyTriggerWord;
        window.showLoraModal = showLoraModal;
        window.confirmDelete = confirmDelete;
        window.closeDeleteModal = closeDeleteModal;
        window.refreshLoras = refreshLoras;
        window.openCivitai = openCivitai;
        window.toggleFolderTags = toggleFolderTags;
        window.toggleApiKeyVisibility = toggleApiKeyVisibility;
        window.downloadManager = this.downloadManager;
        window.moveManager = moveManager;
        window.toggleShowcase = toggleShowcase;
        window.scrollToTop = scrollToTop;
        
        // Bulk operations
        window.toggleBulkMode = () => bulkManager.toggleBulkMode();
        window.clearSelection = () => bulkManager.clearSelection();
        window.toggleCardSelection = (card) => bulkManager.toggleCardSelection(card);
        window.copyAllLorasSyntax = () => bulkManager.copyAllLorasSyntax();
        window.updateSelectedCount = () => bulkManager.updateSelectedCount();
        window.bulkManager = bulkManager;
    }
    
    async initialize() {
        // Initialize page-specific components
        initializeEventListeners();
        restoreFolderFilter();
        initFolderTagsVisibility();
        new LoraContextMenu();
        
        // Initialize cards for current bulk mode state (should be false initially)
        updateCardsForBulkMode(state.bulkMode);
        
        // Initialize the bulk manager
        bulkManager.initialize();
        
        // Initialize common page features (lazy loading, infinite scroll)
        appCore.initializePageFeatures();
    }
}

// Initialize event listeners
function initializeEventListeners() {
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.value = state.sortBy;
        sortSelect.addEventListener('change', async (e) => {
            state.sortBy = e.target.value;
            await resetAndReload();
        });
    }

    document.querySelectorAll('.folder-tags .tag').forEach(tag => {
        tag.addEventListener('click', toggleFolder);
    });
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize core application
    await appCore.initialize();
    
    // Initialize page-specific functionality
    const loraPage = new LoraPageManager();
    await loraPage.initialize();
});