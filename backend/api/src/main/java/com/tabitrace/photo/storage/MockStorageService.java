package com.tabitrace.photo.storage;

import com.tabitrace.photo.dto.PhotoDtos.PresignResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import java.util.UUID;

@Service
@ConditionalOnProperty(name="app.storage.mode",havingValue="mock",matchIfMissing=true)
public class MockStorageService implements StorageService {
    @Override public PresignResponse presign(Long userId,Long tripId,String fileName,String contentType,long fileSize){String key="users/"+userId+"/trips/"+tripId+"/"+UUID.randomUUID()+"."+StorageService.extensionFor(contentType);return new PresignResponse(key,"mock://upload/"+key,publicUrl(key),900,true);}
    @Override public String publicUrl(String storageKey){return "https://example.invalid/r2/"+storageKey;}
}
