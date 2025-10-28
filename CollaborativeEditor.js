import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Save, Download, Upload, FileText, Wifi, WifiOff } from 'lucide-react';
import { io } from 'socket.io-client';

const UserPresence = ({ collaborators, currentUser }) => (
  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
    <Users className="w-4 h-4 text-gray-600" />
    <span className="text-sm text-gray-600">Online:</span>
    <div className="flex space-x-1">
      {collaborators.map(user => (
        <div
          key={user.userId}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white ${
            user.userId === currentUser.userId ? 'bg-blue-500' : 'bg-green-500'
          }`}
          title={user.name}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  </div>
);

const ConnectionStatus = ({ isConnected }) => (
  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
    isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }`}>
    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
    <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
  </div>
);

const getDocumentId = () => {
  const params = new URLSearchParams(window.location.search);
  const existingId = params.get('doc');
  
  if (existingId) {
    return existingId;
  }
  
  return 'doc_' + Math.random().toString(36).substring(2, 11);
};

const CollaborativeEditor = () => {
  const [content, setContent] = useState('');
  const [documentId] = useState(getDocumentId());
  const [currentUser] = useState({
    userId: 'user_' + Math.random().toString(36).substring(2, 9),
    name: 'User ' + Math.floor(Math.random() * 100),
    color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
  });
  const [collaborators, setCollaborators] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [documentTitle, setDocumentTitle] = useState('Untitled Document');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const socketRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const contentRef = useRef(content);

  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('doc', documentId);
    window.history.pushState({}, '', url);
  }, [documentId]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    socketRef.current = io('http://localhost:5000', {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      socketRef.current.emit('join-document', {
        documentId,
        user: currentUser,
      });
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setConnectionError('Failed to connect to server. Trying to reconnect...');
    });

    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
      setConnectionError(error.message || 'An unexpected error occurred');
    });

    socketRef.current.on('remote-operation', ({ operation }) => {
      setContent(operation);
    });

    socketRef.current.on('collaborators-updated', (updatedCollaborators) => {
      setCollaborators(updatedCollaborators);
    });

    socketRef.current.on('document-state', ({ content, title }) => {
      setContent(content);
      setDocumentTitle(title || 'Untitled Document');
    });

    socketRef.current.on('title-updated', (newTitle) => {
      setDocumentTitle(newTitle);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('error');
        socketRef.current.disconnect();
      }
    };
  }, [documentId, currentUser]);

  const autoSave = useCallback((newContent) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    setIsAutoSaving(true);
    saveTimeoutRef.current = setTimeout(() => {
      setLastSaved(new Date());
      setIsAutoSaving(false);
      if (socketRef.current) {
        socketRef.current.emit('document-save', {
          docId: documentId,
          content: newContent,
        });
      }
    }, 1000);
  }, [documentId]);

  const handleTextChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    autoSave(newContent);

    if (socketRef.current) {
      socketRef.current.emit('text-operation', documentId, newContent);
    }
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setDocumentTitle(newTitle);
    if (socketRef.current) {
      socketRef.current.emit('update-title', {
        docId: documentId,
        title: newTitle
      });
    }
  };

  const handleSave = () => {
    setLastSaved(new Date());
    setIsAutoSaving(false);
    if (socketRef.current) {
      socketRef.current.emit('document-save', {
        docId: documentId,
        content: content,
      });
    }
  };

  const handleExport = () => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${documentTitle}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const importedContent = event.target.result;
        setContent(importedContent);
        autoSave(importedContent);

        if (socketRef.current) {
          socketRef.current.emit('text-operation', documentId, importedContent);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <FileText className="w-6 h-6 text-blue-600" />
            <input
              type="text"
              value={documentTitle}
              onChange={handleTitleChange}
              className="text-lg font-medium bg-transparent border-none outline-none focus:bg-gray-50 px-2 py-1 rounded"
            />
          </div>
          <div className="flex items-center space-x-4">
            <ConnectionStatus isConnected={isConnected} />
            <UserPresence collaborators={collaborators} currentUser={currentUser} />
          </div>
        </div>
      </div>

      {connectionError && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <p>{connectionError}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-2 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <button onClick={handleSave} className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
              <Save className="w-4 h-4" /><span>Save</span>
            </button>
            <button onClick={handleExport} className="flex items-center space-x-1 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition">
              <Download className="w-4 h-4" /><span>Export</span>
            </button>
            <label className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer transition">
              <Upload className="w-4 h-4" /><span>Import</span>
              <input type="file" accept=".txt,.md" onChange={handleImport} className="hidden" />
            </label>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link copied to clipboard!');
                }}
                className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
              >
                Copy Share Link
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            {isAutoSaving ? 'Saving...' : lastSaved && `Last saved: ${lastSaved.toLocaleTimeString()}`}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <textarea
            value={content}
            onChange={handleTextChange}
            placeholder="Start typing your document here..."
            className="w-full h-96 p-4 border border-gray-200 rounded-lg resize-none outline-none focus:ring-2 focus:ring-blue-500"
            style={{ minHeight: '500px' }}
          />
        </div>

        <div className="mt-4 p-4 bg-white rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div><strong>Document ID:</strong> {documentId}</div>
          <div><strong>Characters:</strong> {content.length}</div>
          <div><strong>Words:</strong> {content.split(/\s+/).filter(Boolean).length}</div>
        </div>

        <div className="mt-4 p-4 bg-white rounded-lg shadow-sm">
          <h3 className="text-lg font-medium mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {collaborators.map(user => (
              <div key={user.userId} className="flex items-center space-x-2 text-sm">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: user.color }}></div>
                <span className={user.userId === currentUser.userId ? 'font-medium' : ''}>
                  {user.name} {user.userId === currentUser.userId ? '(You)' : ''}
                </span>
                <span className="text-gray-500">is editing</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollaborativeEditor;