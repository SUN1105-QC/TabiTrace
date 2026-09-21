package com.tabitrace.photo.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import java.time.Instant;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import static org.junit.jupiter.api.Assertions.*;

class LocalStorageServiceTest {
    @TempDir Path dir;

    @Test void presignedUploadUrlCarriesValidSignature(){
        LocalStorageService s=new LocalStorageService(dir.toString(),"http://localhost:8080");
        var presign=s.presign(1L,2L,"a.jpg","image/jpeg",100);
        Matcher m=Pattern.compile("&expires=(\\d+)&signature=([0-9a-f]+)$").matcher(presign.uploadUrl());
        assertTrue(m.find());
        long expires=Long.parseLong(m.group(1));String signature=m.group(2);
        assertTrue(s.verifyUpload(presign.storageKey(),expires,signature));
        assertFalse(s.verifyUpload("users/1/trips/3/other.jpg",expires,signature));
        assertFalse(s.verifyUpload(presign.storageKey(),expires+1,signature));
        assertFalse(s.verifyUpload(presign.storageKey(),null,null));
    }

    @Test void rejectsExpiredSignature(){
        LocalStorageService s=new LocalStorageService(dir.toString(),"http://localhost:8080");
        long past=Instant.now().getEpochSecond()-1;
        assertFalse(s.verifyUpload("users/1/trips/2/a.jpg",past,s.sign("users/1/trips/2/a.jpg",past)));
    }
}
