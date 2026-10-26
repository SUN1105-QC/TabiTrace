package com.tabitrace.worker;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class WorkerStorageMusicTest {
    private final WorkerStorage local = new WorkerStorage("local", "", "", "", "", "", "http://localhost:3000/generated-videos");
    private final Path root = Path.of("uploads").toAbsolutePath();
    private final Path cache = Path.of("cache").toAbsolutePath();

    @Test
    void localModeReadsFromStorageRoot() throws IOException {
        assertEquals(root.resolve("music/originals/km_morning-abc.mp3").normalize(),
                local.music("music/originals/km_morning-abc.mp3", root, cache));
    }

    @Test
    void onlyMusicKeysAreAccepted() {
        for (String bad : new String[]{null, "users/1/trips/2/a.jpg", "music/../users/1/a.jpg", "/music/originals/a.mp3", "../music/a.mp3"}) {
            assertThrows(IOException.class, () -> local.music(bad, root, cache), String.valueOf(bad));
        }
    }
}
