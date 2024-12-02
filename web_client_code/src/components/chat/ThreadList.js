// components/chat/ThreadList.js
import React from 'react';
import { API_BASE_URL } from '../../config';

const ThreadList = ({ selectedChannel, threads, onThreadSelect, onCreateThread, theme }) => {
  return (
    <div className="h-100 d-flex flex-column">
      <div className="p-3 border-bottom">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">#{selectedChannel.name}</h5>
          <button onClick={onCreateThread} className="btn btn-success">
            New Thread
          </button>
        </div>
      </div>
      <div className="flex-grow-1 overflow-auto p-3">
        <div className="d-flex flex-column gap-3">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`card ${theme === 'dark' ? 'bg-mid-dark' : ''}`}
              onClick={() => onThreadSelect(thread)}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-body">
                <div className="d-flex gap-3">
                  {thread.first_post_image && (
                    <img
                      src={`${API_BASE_URL}${thread.first_post_image}`}
                      alt=""
                      className="rounded"
                      style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                    />
                  )}
                  <div>
                    <h6 className="card-title">{thread.subject}</h6>
                    <p className="card-text small">{thread.first_post_content}</p>
                    <div className="text-muted small">
                      {thread.author_email ? `Posted by ${thread.author_email}` : 'Anonymous'} ·{' '}
                      {new Date(thread.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ThreadList;
