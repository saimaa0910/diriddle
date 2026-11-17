import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface CreateCityDto {
  name: string;
  slug?: string;
  state_id?: string;
  aliases?: string[];
  center_lat?: number;
  center_lng?: number;
  radius_km?: number;
  is_active?: boolean;
}

@Injectable()
export class CityService {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveCities(filters?: { countryCode?: string }) {
    const cities = await this.prisma.city.findMany({
      where: {
        isActive: true,
        ...(filters?.countryCode
          ? {
              state: {
                country: {
                  code: filters.countryCode.toUpperCase(),
                },
              },
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: cities.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        aliases: c.aliases,
        center_lat: c.centerLat,
        center_lng: c.centerLng,
        radius_km: c.radiusKm,
        is_active: c.isActive,
      })),
    };
  }

  async getCityBySlug(slug: string) {
    const city = await this.prisma.city.findUnique({
      where: { slug: slug.toLowerCase() },
    });

    if (!city) {
      throw new NotFoundException({
        error: 'CITY_NOT_FOUND',
        message: `City with slug '${slug}' not found`,
      });
    }

    return {
      id: city.id,
      name: city.name,
      slug: city.slug,
      aliases: city.aliases,
      center_lat: city.centerLat,
      center_lng: city.centerLng,
      radius_km: city.radiusKm,
      is_active: city.isActive,
    };
  }

  async searchCities(query: string, limit = 20) {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return this.listActiveCities();
    }

    const allCities = await this.prisma.city.findMany({
      where: { isActive: true },
    });

    const filtered = allCities
      .filter((c) => {
        const matchesName = c.name.toLowerCase().includes(trimmed);
        const matchesSlug = c.slug.toLowerCase().includes(trimmed);
        const matchesAlias = c.aliases?.some((a: string) => a.toLowerCase().includes(trimmed));
        return matchesName || matchesSlug || matchesAlias;
      })
      .slice(0, Math.min(Math.max(limit, 1), 50));

    return {
      data: filtered.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        aliases: c.aliases,
      })),
    };
  }

  async createCity(dto: CreateCityDto) {
    const slug = dto.slug ? dto.slug.toLowerCase() : dto.name.toLowerCase().replace(/\s+/g, '-');
    const existing = await this.prisma.city.findUnique({ where: { slug } });
    if (existing) {
      throw new BadRequestException({
        error: 'CITY_SLUG_EXISTS',
        message: `City slug '${slug}' already exists`,
      });
    }

    let stateId = dto.state_id;
    if (!stateId) {
      const defaultState = await this.prisma.state.findFirst();
      stateId = defaultState?.id ?? 'state-default';
    }

    const city = await this.prisma.city.create({
      data: {
        name: dto.name,
        slug,
        stateId,
        aliases: dto.aliases ?? [],
        centerLat: dto.center_lat ?? null,
        centerLng: dto.center_lng ?? null,
        radiusKm: dto.radius_km ?? 30,
        isActive: dto.is_active ?? true,
        activatedAt: dto.is_active ? new Date() : null,
      },
    });

    return {
      id: city.id,
      name: city.name,
      slug: city.slug,
      is_active: city.isActive,
    };
  }

  async activateCity(id: string) {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) {
      throw new NotFoundException({ error: 'CITY_NOT_FOUND', message: 'City not found' });
    }

    const updated = await this.prisma.city.update({
      where: { id },
      data: { isActive: true, activatedAt: new Date() },
    });

    return { id: updated.id, slug: updated.slug, is_active: updated.isActive };
  }

  async deactivateCity(id: string) {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) {
      throw new NotFoundException({ error: 'CITY_NOT_FOUND', message: 'City not found' });
    }

    const updated = await this.prisma.city.update({
      where: { id },
      data: { isActive: false },
    });

    return { id: updated.id, slug: updated.slug, is_active: updated.isActive };
  }
}
