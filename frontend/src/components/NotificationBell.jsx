import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNotifications } from '@/context/NotificationContext';
import NotificationDropdown from './NotificationDropdown';

const DROPDOWN_WIDTH = 380;

export default function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const containerRef = useRef(null);

  const calculatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceOnRight = window.innerWidth - rect.left;

    let left;
    if (spaceOnRight >= DROPDOWN_WIDTH) {
      // Enough space to the right → align left edge of dropdown with left edge of bell
      left = rect.left;
    } else {
      // Not enough space → align right edge of dropdown with right edge of bell
      left = rect.right - DROPDOWN_WIDTH;
    }

    // Clamp so it never goes off either edge
    left = Math.max(12, Math.min(left, window.innerWidth - DROPDOWN_WIDTH - 12));

    setDropdownPos({ top: rect.bottom + 8, left });
  };

  useEffect(() => {
    if (isOpen) calculatePosition();
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      const portalDropdown = document.getElementById('notification-portal');
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        portalDropdown &&
        !portalDropdown.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Reposition on scroll / resize
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('scroll', calculatePosition, true);
    window.addEventListener('resize', calculatePosition);
    return () => {
      window.removeEventListener('scroll', calculatePosition, true);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [isOpen]);

  return (
    <>
      <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
        {/* ── Bell Button ── */}
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(prev => !prev)}
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: isOpen ? '#4F46E5' : 'rgba(0,0,0,0.1)',
            background: isOpen ? '#EEF2FF' : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none',
          }}
          onMouseEnter={e => {
            if (!isOpen) e.currentTarget.style.background = '#F5F5F5';
          }}
          onMouseLeave={e => {
            if (!isOpen) e.currentTarget.style.background = 'transparent';
          }}
        >
          {/* Bell Icon */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isOpen ? '#4F46E5' : '#374151'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>

          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '18px',
                height: '18px',
                padding: '0 4px',
                borderRadius: '9px',
                background: '#EF4444',
                color: '#fff',
                fontSize: '11px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                boxShadow: '0 0 0 2px #fff',
                animation: 'notif-pop 0.3s ease',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Portal Dropdown — renders into document.body, always on top ── */}
      {isOpen &&
        createPortal(
          <div
            id="notification-portal"
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: DROPDOWN_WIDTH,
              zIndex: 99999,
            }}
          >
            <NotificationDropdown onClose={() => setIsOpen(false)} />
          </div>,
          document.body
        )}

      <style>{`
        @keyframes notif-pop {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.2); }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </>
  );
}