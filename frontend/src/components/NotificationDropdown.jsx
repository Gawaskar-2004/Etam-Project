import { useNotifications } from '@/context/NotificationContext';

const TYPE_CONFIG = {
  ATTENDANCE:      { icon: '📋', color: '#3B82F6', bg: '#EFF6FF', label: 'Attendance' },
  TIMETABLE:       { icon: '📅', color: '#8B5CF6', bg: '#F5F3FF', label: 'Timetable' },
  LEAVE:           { icon: '🏖️', color: '#F59E0B', bg: '#FFFBEB', label: 'Leave' },
  SYSTEM:          { icon: '📢', color: '#6B7280', bg: '#F9FAFB', label: 'System' },
  PERFORMANCE:     { icon: '📊', color: '#10B981', bg: '#ECFDF5', label: 'Performance' },
  FACE_ATTENDANCE: { icon: '📸', color: '#EC4899', bg: '#FDF2F8', label: 'Face' },
  MEETING:         { icon: '🤝', color: '#F97316', bg: '#FFF7ED', label: 'Meeting' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function NotificationDropdown({ onClose }) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const handleMarkRead = async (e, id, isRead) => {
    e.stopPropagation();
    if (!isRead) await markAsRead(id);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await deleteNotification(id);
  };

  return (
    <div
      style={{
        // ✅ No position/top/right here — the portal wrapper in NotificationBell handles placement
        width: '380px',
        maxHeight: '520px',
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'dropdown-in 0.2s ease',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px 12px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '15px', color: '#111827' }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span
              style={{
                background: '#4F46E5',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: '10px',
              }}
            >
              {unreadCount} new
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                fontSize: '12px',
                color: '#4F46E5',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                padding: '2px 0',
              }}
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close notifications"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: '1px solid rgba(0,0,0,0.08)',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6B7280',
              fontSize: '16px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Notification List ── */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifications.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: '#9CA3AF',
            }}
          >
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔔</div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#6B7280' }}>
              No notifications yet
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              You're all caught up!
            </div>
          </div>
        ) : (
          notifications.map((notif) => {
            const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.SYSTEM;
            return (
              <div
                key={notif.id}
                onClick={(e) => handleMarkRead(e, notif.id, notif.isRead)}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '14px 18px',
                  background: notif.isRead ? '#fff' : '#F8F7FF',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                  cursor: notif.isRead ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = notif.isRead ? '#F9FAFB' : '#F0EFFE';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = notif.isRead ? '#fff' : '#F8F7FF';
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: config.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0,
                  }}
                >
                  {config.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: notif.isRead ? 400 : 600,
                        color: '#111827',
                        lineHeight: 1.3,
                      }}
                    >
                      {notif.title}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#9CA3AF',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}
                    >
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '12px',
                      color: '#6B7280',
                      margin: '3px 0 6px',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {notif.message}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Type badge */}
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        color: config.color,
                        background: config.bg,
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {config.label}
                    </span>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, notif.id)}
                      style={{
                        fontSize: '11px',
                        color: '#D1D5DB',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        lineHeight: 1,
                        marginLeft: 'auto',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#D1D5DB'}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Unread dot */}
                {!notif.isRead && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '16px',
                      right: '14px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#4F46E5',
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer ── */}
      {notifications.length > 0 && (
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
            {notifications.length} total notification{notifications.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <style>{`
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}