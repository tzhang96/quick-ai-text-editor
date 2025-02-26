import React from 'react';

interface ExportMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onExportHTML: () => void;
  onExportMarkdown: () => void;
  onExportText: () => void;
}

const ExportMenu: React.FC<ExportMenuProps> = ({
  isOpen,
  onClose,
  onExportHTML,
  onExportMarkdown,
  onExportText
}) => {
  if (!isOpen) return null;
  
  // Function to handle clicking on a menu item
  const handleMenuItemClick = (action: () => void) => {
    action();
    onClose(); // Close the menu after an action is performed
  };
  
  return (
    <div className="absolute left-0 top-full mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50" data-export-menu>
      <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="export-button">
        <button
          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          role="menuitem"
          onClick={() => handleMenuItemClick(onExportHTML)}
        >
          Export as HTML
        </button>
        <button
          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          role="menuitem"
          onClick={() => handleMenuItemClick(onExportMarkdown)}
        >
          Export as Markdown
        </button>
        <button
          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          role="menuitem"
          onClick={() => handleMenuItemClick(onExportText)}
        >
          Export as Text
        </button>
      </div>
    </div>
  );
};

export default ExportMenu; 