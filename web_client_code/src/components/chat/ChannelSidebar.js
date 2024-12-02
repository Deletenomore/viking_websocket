import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ChannelSidebar = ({ selectedRoom, channels, selectedChannel, onChannelSelect, theme }) => {
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const buttonThemeClasses = theme === 'dark' ? 'btn-outline-light' : 'btn-outline-dark';
  const selectedButtonClasses = theme === 'dark' ? 'btn-primary' : 'btn-primary';
  const navigate = useNavigate();

  const handleCreateChannel = (categoryId) => {
    navigate(`/v/${selectedRoom.url_name}/create-channel/${categoryId}`);
  };

  const handleCreateCategory = () => {
    navigate(`/v/${selectedRoom.url_name}/create-category`);
  };

  const toggleCategory = (categoryId) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const renderChannel = (channel) => (
    <button
      key={channel.id}
      onClick={() => onChannelSelect(channel)}
      className={`btn text-start p-2 ${selectedChannel?.id === channel.id ? selectedButtonClasses : buttonThemeClasses}`}
    >
      <div className="d-flex align-items-center">
        <i className="bi bi-hash me-2"></i>
        <span>{channel.name}</span>
      </div>
    </button>
  );

  const renderCategory = (category) => (
    <div key={category.id} className="category-group mb-2">
      <div className="d-flex align-items-center justify-content-between">
        <button
          className={`btn btn-link text-decoration-none p-1 text-start d-flex align-items-center flex-grow-1 ${
            theme === 'dark' ? 'text-light' : 'text-dark'
          }`}
          onClick={() => toggleCategory(category.id)}
        >
          <i className={`bi bi-chevron-${collapsedCategories[category.id] ? 'right' : 'down'} me-2`}></i>
          <span className="text-uppercase small fw-bold">{category.name}</span>
        </button>
        {selectedRoom.is_admin && (
          <button
            className={`btn btn-link p-0 px-2 ${theme === 'dark' ? 'text-light' : 'text-dark'}`}
            onClick={() => handleCreateChannel(category.id)}
            title="Create new channel"
          >
            <i className="bi bi-plus"></i>
          </button>
        )}
      </div>

      <div className={`ms-3 d-flex flex-column gap-1 ${collapsedCategories[category.id] ? 'd-none' : ''}`}>
        {category.channels.map((channel) => renderChannel(channel))}
      </div>
    </div>
  );

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">{selectedRoom.name}</h6>
        {selectedRoom.is_admin && (
          <button className="btn btn-success btn-sm" onClick={handleCreateCategory} title="Create new category">
            <i className="bi bi-plus"></i>
          </button>
        )}
      </div>
      <div className="d-flex flex-column gap-2">{selectedRoom.categories?.map((category) => renderCategory(category))}</div>
    </div>
  );
};

export default ChannelSidebar;
