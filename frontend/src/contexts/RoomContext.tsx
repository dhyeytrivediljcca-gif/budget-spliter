import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Room } from '../types';
import { roomsApi } from '../api';

interface RoomContextValue {
  activeRoom: Room | null;
  setActiveRoom: (room: Room | null) => void;
  refreshActiveRoom: () => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [activeRoom, setActiveRoomState] = useState<Room | null>(() => {
    try {
      const stored = localStorage.getItem('roomiesplit_active_room');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setActiveRoom = useCallback((room: Room | null) => {
    setActiveRoomState(room);
    if (room) {
      localStorage.setItem('roomiesplit_active_room', JSON.stringify(room));
    } else {
      localStorage.removeItem('roomiesplit_active_room');
    }
  }, []);

  const refreshActiveRoom = useCallback(async () => {
    try {
      const rooms = await roomsApi.list();
      if (rooms && rooms.length > 0) {
        // If current active room exists in list, keep it or update it
        const current = activeRoom ? rooms.find(r => r.id === activeRoom.id) : null;
        const target = current || rooms[0];
        setActiveRoom(target);
      }
    } catch {
      // Ignored if unauthenticated
    }
  }, [activeRoom, setActiveRoom]);

  useEffect(() => {
    // If no active room in storage, attempt to fetch user's rooms
    if (!activeRoom) {
      roomsApi.list().then(rooms => {
        if (rooms && rooms.length > 0) {
          setActiveRoom(rooms[0]);
        }
      }).catch(() => {});
    }
  }, [activeRoom, setActiveRoom]);

  return (
    <RoomContext.Provider value={{ activeRoom, setActiveRoom, refreshActiveRoom }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used inside RoomProvider');
  return ctx;
}
