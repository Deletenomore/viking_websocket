// components/create-room/CreateRoom.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import Layout from './Layout';
import DetailsForm from './DetailsForm';
import SettingsForm from './SettingsForm';

const CreateRoom = ({ theme }) => {
  const navigate = useNavigate();

  // Form state
  const [formState, setFormState] = useState({
    roomName: '',
    urlName: '',
    description: '',
    thumbnailImage: null,
    previewUrl: '',
  });

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // URL validation state
  const [urlCheckState, setUrlCheckState] = useState({
    isChecking: false,
    isAvailable: null,
    message: '',
    showFeedback: false,
  });

  // Room settings state
  const [settings, setSettings] = useState({
    isPublic: false,
    allowAnonymous: true,
    allowUserThreads: true,
    threadLimit: 500,
    anonymousUniquePerThread: false,
    showCountryFlags: false,
    allowAccountless: false,
    postsPerThread: 1000,
    isNsfw: false,
  });

  // Suggest URL based on room name
  useEffect(() => {
    if (!formState.urlName) {
      const suggested = formState.roomName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
      setFormState((prev) => ({ ...prev, urlName: suggested }));
    }
  }, [formState.roomName, formState.urlName]);

  // URL availability check
  const checkUrlAvailability = useCallback(async (value) => {
    if (!value || value.length < 3) {
      setUrlCheckState({
        isChecking: false,
        isAvailable: null,
        message: 'URL must be at least 3 characters long',
        showFeedback: true,
      });
      return;
    }

    setUrlCheckState((prev) => ({
      ...prev,
      isChecking: true,
      showFeedback: true,
    }));

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/rooms/check-url/${value}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await response.json();

      if (response.ok) {
        setUrlCheckState({
          isChecking: false,
          isAvailable: data.available,
          message: data.message || (data.available ? 'This URL is available!' : 'This URL is already taken'),
          showFeedback: true,
        });

        if (data.formattedUrl !== value) {
          setFormState((prev) => ({ ...prev, urlName: data.formattedUrl }));
        }
      }
    } catch (error) {
      console.error('Error checking URL availability:', error);
      setUrlCheckState({
        isChecking: false,
        isAvailable: null,
        message: 'Error checking URL availability',
        showFeedback: true,
      });
    }
  }, []);

  // Debounced URL check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formState.urlName) {
        checkUrlAvailability(formState.urlName);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formState.urlName, checkUrlAvailability]);

  // Form field change handlers
  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (file, previewUrl) => {
    setFormState((prev) => ({
      ...prev,
      thumbnailImage: file,
      previewUrl: previewUrl,
    }));
  };

  const handleSettingChange = (setting, value) => {
    setSettings((prev) => ({ ...prev, [setting]: value }));
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!urlCheckState.isAvailable) {
      setError('Please choose an available URL name');
      setIsLoading(false);
      return;
    }

    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        navigate('/login');
        return;
      }

      const submitFormData = new FormData();
      // Basic details
      submitFormData.append('name', formState.roomName);
      submitFormData.append('urlName', formState.urlName);
      submitFormData.append('description', formState.description);
      if (formState.thumbnailImage) {
        submitFormData.append('thumbnail', formState.thumbnailImage);
      }

      // Settings
      Object.entries(settings).forEach(([key, value]) => {
        if (key === 'threadLimit') {
          submitFormData.append(key, value === 500 ? 'null' : value.toString());
        } else if (key === 'postsPerThread') {
          submitFormData.append(key, value === 1000 ? 'null' : value.toString());
        } else {
          submitFormData.append(key, value.toString());
        }
      });

      const response = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: submitFormData,
      });

      const data = await response.json();

      if (response.ok) {
        navigate(`/v/${data.urlName}`);
      } else {
        if (response.status === 401) {
          navigate('/login');
        } else {
          setError(data.message || 'Failed to create room');
        }
      }
    } catch (error) {
      console.error('Error creating room:', error);
      setError('An error occurred while creating the room');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout theme={theme} error={error}>
      <form onSubmit={handleSubmit}>
        <DetailsForm
          theme={theme}
          formData={formState}
          urlCheckState={urlCheckState}
          isLoading={isLoading}
          onFieldChange={handleFieldChange}
          onImageChange={handleImageChange}
        />

        <SettingsForm theme={theme} settings={settings} onSettingChange={handleSettingChange} />

        <div className="d-grid gap-2">
          <button type="submit" className="btn btn-primary" disabled={isLoading || !urlCheckState.isAvailable}>
            {isLoading ? 'Creating...' : 'Create Room'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/chat')}>
            Cancel
          </button>
        </div>
      </form>
    </Layout>
  );
};

export default CreateRoom;
