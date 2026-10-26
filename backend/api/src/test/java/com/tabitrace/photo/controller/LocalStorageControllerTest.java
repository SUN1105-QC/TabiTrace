package com.tabitrace.photo.controller;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalStorageControllerTest {
    @Test
    void originalMusicIsNeverServed() {
        assertTrue(LocalStorageController.privateKey("music/originals/sb_wanderlust-1dda9c6a8c.mp3"));
        assertTrue(LocalStorageController.privateKey("music/previews/../originals/sb_wanderlust-1dda9c6a8c.mp3"));
        assertTrue(LocalStorageController.privateKey("Music/Originals/x.mp3"));
        assertTrue(LocalStorageController.privateKey("music\\originals\\x.mp3"));
        assertFalse(LocalStorageController.privateKey("music/previews/sb_wanderlust-1dda9c6a8c.mp3"));
        assertFalse(LocalStorageController.privateKey("users/1/trips/2/a.jpg"));
    }

    @Test
    void contentTypeFollowsExtension() {
        assertEquals("audio/mpeg", LocalStorageController.contentType("music/previews/a.mp3"));
        assertEquals("image/png", LocalStorageController.contentType("avatars/a.PNG"));
        assertEquals("image/webp", LocalStorageController.contentType("a.webp"));
        assertEquals("image/jpeg", LocalStorageController.contentType("users/1/trips/2/a.jpg"));
    }
}
