package com.tabitrace.city;

import com.tabitrace.city.mapper.ExploreDirectoryMapper;
import com.tabitrace.city.mapper.ExploreDirectoryMapper.*;
import com.tabitrace.city.service.ExploreDirectoryService;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ExploreDirectoryServiceTest {
    ExploreDirectoryMapper mapper=mock(ExploreDirectoryMapper.class);
    ExploreDirectoryService service=new ExploreDirectoryService(mapper,new ObjectMapper());
    CountryRow country(String code,boolean published) {
        var r=new CountryRow();r.code=code;r.slug=code.toLowerCase();r.name=code;r.englishName=code;r.published=published;return r;
    }
    CityRow city(String code,String country,String status,String href) {
        var r=new CityRow();r.code=code;r.countryCode=country;r.name=code;r.englishName=code;r.status=status;
        r.published=true;r.explorePath=href;r.placeCount=30;r.routeCount=6;r.tagsJson="[\"漫步\"]";return r;
    }
    @Test void countsOnlyPublishedOpenGuidesAndPreservesPreviewStatus() {
        when(mapper.countries()).thenReturn(List.of(country("JP",true),country("KR",true),country("CN",true)));
        when(mapper.cities()).thenReturn(List.of(city("TOKYO","JP","ACTIVE","/explore/tokyo"),
                city("OSAKA","JP","COMING_SOON",null),city("SEOUL","KR","PLANNED",null)));
        var result=service.load();
        assertEquals(new ExploreDirectoryService.Stats(3,3,1,1,30,6),result.stats());
        var preview=result.countries().getFirst().cities().get(1);
        assertEquals("PREPARING",preview.status());assertNull(preview.href());assertEquals(0,preview.placeCount());
        assertEquals("PLANNED",result.countries().get(1).cities().getFirst().status());
        assertTrue(result.countries().get(2).cities().isEmpty());
    }
    @Test void privateDraftAndUnknownStatusesNeverLeakEvenIfQueryReturnsThem() {
        var hidden=city("HIDDEN","JP","ACTIVE","/explore/tokyo");hidden.published=false;
        when(mapper.countries()).thenReturn(List.of(country("JP",true),country("PRIVATE",false)));
        when(mapper.cities()).thenReturn(List.of(hidden,city("DRAFT","JP","DRAFT",null),
                city("FUTURE","JP","INTERNAL",null),city("PRIVATE_CITY","PRIVATE","ACTIVE","/explore/tokyo")));
        var result=service.load();assertEquals(1,result.countries().size());assertEquals(0,result.stats().cityCount());
    }
    @Test void unimplementedAndExternalRoutesDoNotBecomeClickableOpenCities() {
        when(mapper.countries()).thenReturn(List.of(country("FR",true)));
        when(mapper.cities()).thenReturn(List.of(city("PARIS","FR","ACTIVE","/explore/paris"),
                city("EXTERNAL","FR","ACTIVE","https://example.com"),city("NULL","FR","ACTIVE",null)));
        var result=service.load();assertEquals(0,result.stats().openCityCount());
        assertTrue(result.countries().getFirst().cities().stream().allMatch(c->c.href()==null));
    }
    @Test void fourImplementedGuidesOpenWithoutPromotingUnimplementedCities() {
        when(mapper.countries()).thenReturn(List.of(country("JP",true),country("KR",true),country("CN",true)));
        when(mapper.cities()).thenReturn(List.of(city("TOKYO","JP","ACTIVE","/explore/tokyo"),
            city("SEOUL","KR","ACTIVE","/explore/seoul"),city("HONGKONG","CN","ACTIVE","/explore/hong-kong"),
            city("TAIPEI","CN","ACTIVE","/explore/taipei"),city("OSAKA","JP","COMING_SOON",null)));
        var result=service.load();
        assertEquals(new ExploreDirectoryService.Stats(3,5,3,4,120,24),result.stats());
        assertEquals(2,result.countries().get(2).cities().size());
        assertTrue(result.countries().get(2).cities().stream().allMatch(c->"OPEN".equals(c.status())));
    }
    @Test void badTagsDoNotHideCountriesAndMissingOptionalCopyStaysOptional() {
        var r=city("TOKYO","JP","ACTIVE","/explore/tokyo");r.tagsJson="{broken";
        when(mapper.countries()).thenReturn(List.of(country("JP",true)));when(mapper.cities()).thenReturn(List.of(r));
        assertTrue(service.load().countries().getFirst().cities().getFirst().tags().isEmpty());
        verify(mapper).countries();verify(mapper).cities();verifyNoMoreInteractions(mapper);
    }
}
