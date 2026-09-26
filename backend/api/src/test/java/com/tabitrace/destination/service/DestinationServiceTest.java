package com.tabitrace.destination.service;

import com.tabitrace.destination.mapper.DestinationMapper;
import com.tabitrace.destination.mapper.DestinationMapper.DestinationRow;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DestinationServiceTest {
    @Test
    void likeWildcardsAreEscapedAndQueryTrimmed() {
        assertEquals("100\\%\\_a\\\\b", DestinationService.escapeLike("100%_a\\b"));
        assertEquals("东京", DestinationService.normalize("  东京 "));
        assertEquals("", DestinationService.normalize(null));
        assertEquals(50, DestinationService.normalize("x".repeat(80)).length());
    }

    @Test
    void officialGuideOnlyForOfficialCitiesWithRealCounts() {
        DestinationMapper mapper = mock(DestinationMapper.class);
        DestinationRow tokyo = new DestinationRow(); tokyo.id = 1L; tokyo.name = "东京"; tokyo.officialCode = "TOKYO"; tokyo.officialName = "东京"; tokyo.officialCover = "/c.jpg";
        DestinationRow osaka = new DestinationRow(); osaka.id = 2L; osaka.name = "大阪";
        when(mapper.search(eq("东"), eq("东"), eq(10))).thenReturn(List.of(tokyo, osaka));
        when(mapper.countOfficialPlaces("东京")).thenReturn(30);
        when(mapper.countRoutes("TOKYO")).thenReturn(4);
        var out = new DestinationService(mapper).search("东", 99);
        assertEquals(30, out.get(0).official().placeCount());
        assertEquals(4, out.get(0).official().routeCount());
        assertEquals("/c.jpg", out.get(0).coverImage());
        assertNull(out.get(1).official());
        assertNull(out.get(1).coverImage());
        verify(mapper, never()).countRoutes(isNull());
    }
}
