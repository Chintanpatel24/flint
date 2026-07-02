import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

export const CommandList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return null;
  }

  return (
    <div className="command-list" style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
      overflow: 'hidden',
      padding: '4px',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: '150px'
    }}>
      {props.items.map((item: any, index: number) => (
        <button
          className={`item ${index === selectedIndex ? 'is-selected' : ''}`}
          key={index}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
          style={{
            background: index === selectedIndex ? '#2a2a2a' : 'transparent',
            border: 'none',
            color: '#eee',
            padding: '6px 12px',
            textAlign: 'left',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
});
